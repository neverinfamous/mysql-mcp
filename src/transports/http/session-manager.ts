/* eslint-disable @typescript-eslint/no-deprecated -- Intentional: SSEServerTransport provides backward compatibility */
/**
 * mysql-mcp - HTTP Session Manager
 *
 * Manages HTTP session lifecycle including idle timeouts, absolute TTLs,
 * and in-flight request protection to prevent orphaned sessions.
 */

import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { logger } from "../../utils/logger.js";
import {
  SESSION_IDLE_TIMEOUT_MS,
  SESSION_SWEEP_INTERVAL_MS,
  SESSION_ABSOLUTE_TTL_MS,
} from "./types.js";

/**
 * Represents a managed transport session
 */
export interface ManagedSession {
  sessionId: string;
  transport: StreamableHTTPServerTransport | SSEServerTransport;
  createdAt: number;
  lastActivity: number;
  inFlightRequests: number;
}

/**
 * Manages HTTP session lifecycle
 */
export class SessionManager {
  private readonly sessions = new Map<string, ManagedSession>();
  private sweepTimer: NodeJS.Timeout | null = null;

  /**
   * Register a new session
   */
  register(
    sessionId: string,
    transport: StreamableHTTPServerTransport | SSEServerTransport,
  ): void {
    const now = Date.now();
    this.sessions.set(sessionId, {
      sessionId,
      transport,
      createdAt: now,
      lastActivity: now,
      inFlightRequests: 0,
    });
    logger.debug("HTTP session registered", { sessionId });
  }

  /**
   * Get an active session by ID
   */
  get(sessionId: string): ManagedSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Update the last activity timestamp for a session
   */
  touch(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Increment the in-flight request counter for a session
   */
  incrementInFlight(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.inFlightRequests++;
    }
  }

  /**
   * Decrement the in-flight request counter for a session
   */
  decrementInFlight(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.inFlightRequests > 0) {
      session.inFlightRequests--;
    }
  }

  /**
   * Close and remove a session
   */
  async close(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      try {
        await session.transport.close();
      } catch (error: unknown) {
        logger.warn("Error closing session transport", { 
          sessionId, 
          error: String(error) 
        });
      }
      logger.debug("HTTP session closed", { sessionId });
    }
  }

  /**
   * Start the periodic session cleanup sweep
   */
  startSweep(): void {
    if (this.sweepTimer) return;

    this.sweepTimer = setInterval(() => {
      this.sweep();
    }, SESSION_SWEEP_INTERVAL_MS);
    
    // Don't block process exit
    this.sweepTimer.unref();
  }

  /**
   * Stop the periodic session cleanup sweep
   */
  stopSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /**
   * Perform a single sweep to expire idle or stale sessions
   */
  private sweep(): void {
    const now = Date.now();

    for (const [sessionId, session] of this.sessions) {
      // Never reap sessions with active requests
      if (session.inFlightRequests > 0) {
        continue;
      }

      const idleMs = now - session.lastActivity;
      const ageMs = now - session.createdAt;

      if (
        idleMs > SESSION_IDLE_TIMEOUT_MS ||
        ageMs > SESSION_ABSOLUTE_TTL_MS
      ) {
        logger.info("Expiring HTTP session", {
          sessionId,
          idleMinutes: Math.round(idleMs / 60_000),
          ageMinutes: Math.round(ageMs / 60_000),
          reason: idleMs > SESSION_IDLE_TIMEOUT_MS ? "idle" : "ttl",
        });

        // Fire and forget close (removes from map when complete or handles internally)
        void this.close(sessionId);
      }
    }
  }

  /**
   * Close all active sessions
   */
  async closeAll(): Promise<void> {
    this.stopSweep();
    
    const closePromises: Promise<void>[] = [];
    for (const sessionId of this.sessions.keys()) {
      closePromises.push(this.close(sessionId));
    }
    
    await Promise.allSettled(closePromises);
    this.sessions.clear();
  }

  /**
   * Get the underlying transports map (useful for backwards compatibility or tests)
   */
  getTransports(): Map<string, StreamableHTTPServerTransport | SSEServerTransport> {
    const map = new Map<string, StreamableHTTPServerTransport | SSEServerTransport>();
    for (const [id, session] of this.sessions) {
      map.set(id, session.transport);
    }
    return map;
  }

  /**
   * Get the number of active sessions
   */
  get size(): number {
    return this.sessions.size;
  }
}

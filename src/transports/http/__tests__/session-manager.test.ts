import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SessionManager } from "../session-manager.js";
import {
  SESSION_IDLE_TIMEOUT_MS,
} from "../types.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

describe("SessionManager", () => {
  let sessionManager: SessionManager;
  let mockTransport: StreamableHTTPServerTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    sessionManager = new SessionManager();
    mockTransport = {
      close: vi.fn().mockResolvedValue(undefined),
    } as unknown as StreamableHTTPServerTransport;
  });

  afterEach(() => {
    sessionManager.closeAll();
    vi.useRealTimers();
  });

  describe("Lifecycle", () => {
    it("should register and retrieve a session", () => {
      sessionManager.register("test-1", mockTransport);
      
      const session = sessionManager.get("test-1");
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("test-1");
      expect(session?.transport).toBe(mockTransport);
      expect(session?.inFlightRequests).toBe(0);
      expect(sessionManager.size).toBe(1);
    });

    it("should return undefined for unknown session", () => {
      expect(sessionManager.get("nonexistent")).toBeUndefined();
    });

    it("should touch a session to update lastActivity", () => {
      sessionManager.register("test-1", mockTransport);
      const session = sessionManager.get("test-1")!;
      const initialActivity = session.lastActivity;

      vi.advanceTimersByTime(1000);
      sessionManager.touch("test-1");

      expect(session.lastActivity).toBeGreaterThan(initialActivity);
      expect(session.lastActivity).toBe(initialActivity + 1000);
    });

    it("should track in-flight requests", () => {
      sessionManager.register("test-1", mockTransport);
      const session = sessionManager.get("test-1")!;

      sessionManager.incrementInFlight("test-1");
      expect(session.inFlightRequests).toBe(1);

      sessionManager.incrementInFlight("test-1");
      expect(session.inFlightRequests).toBe(2);

      sessionManager.decrementInFlight("test-1");
      expect(session.inFlightRequests).toBe(1);

      sessionManager.decrementInFlight("test-1");
      expect(session.inFlightRequests).toBe(0);

      // Should not go below zero
      sessionManager.decrementInFlight("test-1");
      expect(session.inFlightRequests).toBe(0);
    });

    it("should close a session and remove it", async () => {
      sessionManager.register("test-1", mockTransport);
      
      await sessionManager.close("test-1");
      
      expect(mockTransport.close).toHaveBeenCalled();
      expect(sessionManager.get("test-1")).toBeUndefined();
      expect(sessionManager.size).toBe(0);
    });

    it("should close all sessions", async () => {
      const mockTransport2 = {
        close: vi.fn().mockResolvedValue(undefined),
      } as unknown as StreamableHTTPServerTransport;

      sessionManager.register("test-1", mockTransport);
      sessionManager.register("test-2", mockTransport2);
      
      await sessionManager.closeAll();
      
      expect(mockTransport.close).toHaveBeenCalled();
      expect(mockTransport2.close).toHaveBeenCalled();
      expect(sessionManager.size).toBe(0);
    });
  });

  describe("Sweep logic", () => {
    it("should expire idle sessions", async () => {
      sessionManager.startSweep();
      sessionManager.register("test-1", mockTransport);

      // Advance past idle timeout (31 mins)
      await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS + 60_000);

      // Verify closed
      expect(mockTransport.close).toHaveBeenCalled();
      expect(sessionManager.size).toBe(0);
    });

    it("should not expire active sessions", async () => {
      sessionManager.startSweep();
      sessionManager.register("test-1", mockTransport);

      // Advance 20 mins
      await vi.advanceTimersByTimeAsync(20 * 60_000);
      
      // Touch
      sessionManager.touch("test-1");
      
      // Advance another 20 mins
      await vi.advanceTimersByTimeAsync(20 * 60_000);

      // Total time is 40 mins, but only 20 since last touch -> should not be expired
      expect(mockTransport.close).not.toHaveBeenCalled();
      expect(sessionManager.size).toBe(1);
    });

    it("should expire sessions past absolute TTL even if active", async () => {
      sessionManager.startSweep();
      sessionManager.register("test-1", mockTransport);

      // Advance 23 hours
      await vi.advanceTimersByTimeAsync(23 * 60 * 60_000);
      sessionManager.touch("test-1"); // active recently

      // Advance another 2 hours (total 25 hours -> past TTL)
      await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);

      expect(mockTransport.close).toHaveBeenCalled();
      expect(sessionManager.size).toBe(0);
    });

    it("should not expire idle sessions with in-flight requests", async () => {
      sessionManager.startSweep();
      sessionManager.register("test-1", mockTransport);
      
      // Lock it
      sessionManager.incrementInFlight("test-1");

      // Advance past idle timeout
      await vi.advanceTimersByTimeAsync(SESSION_IDLE_TIMEOUT_MS + 60_000);

      // Should still be alive
      expect(mockTransport.close).not.toHaveBeenCalled();
      expect(sessionManager.size).toBe(1);
      
      // Release lock
      sessionManager.decrementInFlight("test-1");
      
      // Next sweep should expire it
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockTransport.close).toHaveBeenCalled();
      expect(sessionManager.size).toBe(0);
    });
  });

  describe("getTransports()", () => {
    it("should return map of underlying transports", () => {
      sessionManager.register("test-1", mockTransport);
      const map = sessionManager.getTransports();
      
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(1);
      expect(map.get("test-1")).toBe(mockTransport);
    });
  });
});

/**
 * mysql-mcp - HTTP Transport Types
 *
 * Shared types, interfaces, and constants for the HTTP transport layer.
 */

import type { OAuthResourceServer } from "../../auth/OAuthResourceServer.js";
import type { TokenValidator } from "../../auth/TokenValidator.js";

// =============================================================================
// Server Timeout Constants
// =============================================================================

/**
 * Maximum time (ms) the server waits for a complete HTTP request.
 * Prevents slowloris-style attacks where clients send data very slowly.
 * 120 seconds allows for legitimate large payloads while blocking stalls.
 */
export const HTTP_REQUEST_TIMEOUT_MS = 120_000;

/**
 * How long (ms) the server keeps an idle connection open for reuse.
 * 65 seconds is slightly above common load-balancer/proxy idle timeouts
 * (typically 60s) to avoid premature server-side closes.
 */
export const HTTP_KEEP_ALIVE_TIMEOUT_MS = 65_000;

/**
 * Maximum time (ms) the server waits to receive HTTP headers.
 * Must be > keepAliveTimeout to prevent a race. 66s provides a 1s buffer.
 * Mitigates slow-header attacks (e.g., Slowloris).
 */
export const HTTP_HEADERS_TIMEOUT_MS = 66_000;

// =============================================================================
// HTTP Transport Configuration
// =============================================================================

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
  /** Port to listen on */
  port: number;

  /** Host to bind to (default: localhost) */
  host?: string;

  /** OAuth resource server (optional) */
  resourceServer?: OAuthResourceServer;

  /** Token validator (optional, required if resourceServer is provided) */
  tokenValidator?: TokenValidator;

  /** CORS allowed origins (default: none) */
  corsOrigins?: string[];

  /** Allow credentials in CORS requests (default: false) */
  corsAllowCredentials?: boolean;

  /** Paths that bypass authentication */
  publicPaths?: string[];

  /** Simple bearer token for lightweight authentication (alternative to OAuth) */
  authToken?: string;

  /** Enable stateless mode — no sessions, no SSE, each request is independent */
  stateless?: boolean;

  // =========================================================================
  // Security Options
  // =========================================================================

  /**
   * Enable rate limiting (default: true)
   * Helps prevent DoS attacks and brute-force attempts
   */
  enableRateLimit?: boolean;

  /**
   * Rate limit window in milliseconds (default: 60000 = 1 minute)
   */
  rateLimitWindowMs?: number;

  /**
   * Maximum requests per window per IP (default: 100)
   */
  rateLimitMaxRequests?: number;

  /**
   * Maximum request body size in bytes (default: 1MB = 1048576)
   * Prevents memory exhaustion from large payloads
   */
  maxBodySize?: number;

  /**
   * Enable HTTP Strict Transport Security header (default: false)
   * Should only be enabled when running behind HTTPS
   */
  enableHSTS?: boolean;

  /**
   * HSTS max-age in seconds (default: 31536000 = 1 year)
   */
  hstsMaxAge?: number;

  /**
   * Trust X-Forwarded-For header for client IP extraction (default: false)
   * Enable when running behind a reverse proxy (nginx, ALB, Cloudflare, etc.)
   */
  trustProxy?: boolean;
}

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Rate limit entry for tracking request counts per IP
 */
export interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// =============================================================================
// Default Constants
// =============================================================================

/** Default rate limit window: 1 minute */
export const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;

/** Default max requests per window per IP */
export const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 100;

/** Default max request body size: 1 MB */
export const DEFAULT_MAX_BODY_SIZE = 1_048_576;

/** Default HSTS max-age: 1 year */
export const DEFAULT_HSTS_MAX_AGE = 31_536_000;

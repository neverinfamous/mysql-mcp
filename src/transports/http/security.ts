/**
 * mysql-mcp - HTTP Transport Security
 *
 * Security utilities: rate limiting, headers, CORS, body parsing, client IP.
 */

import type { IncomingMessage, ServerResponse } from "node:http";
import type { HttpTransportConfig, RateLimitEntry } from "./types.js";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_HSTS_MAX_AGE,
} from "./types.js";

// =============================================================================
// Rate Limiting
// =============================================================================

/**
 * Extract client IP, respecting trustProxy configuration.
 * When trustProxy is enabled, reads X-Forwarded-For first hop.
 */
export function getClientIp(
  req: IncomingMessage,
  trustProxy?: boolean,
): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      const firstIp = forwarded.split(",")[0]?.trim();
      if (firstIp) return firstIp;
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Check rate limit for a request.
 * Returns object with `allowed` flag and optional `retryAfterSeconds`.
 */
export function checkRateLimit(
  req: IncomingMessage,
  config: HttpTransportConfig,
  rateLimitMap: Map<string, RateLimitEntry>,
): { allowed: boolean; retryAfterSeconds?: number } {
  if (!config.enableRateLimit) {
    return { allowed: true };
  }

  const clientIp = getClientIp(req, config.trustProxy);
  const now = Date.now();
  const windowMs = config.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS;
  const maxRequests =
    config.rateLimitMaxRequests ?? DEFAULT_RATE_LIMIT_MAX_REQUESTS;

  const entry = rateLimitMap.get(clientIp);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(clientIp, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= maxRequests) {
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  entry.count++;
  return { allowed: true };
}

// =============================================================================
// Security Headers
// =============================================================================

/**
 * Set security headers for all responses.
 *
 * Headers applied:
 * 1. X-Content-Type-Options — prevent MIME type sniffing
 * 2. X-Frame-Options — prevent clickjacking
 * 3. Cache-Control — prevent caching of API responses
 * 4. Content-Security-Policy — no content to load
 * 5. Permissions-Policy — restrict browser features
 * 6. Referrer-Policy — no referrer header on navigation
 * 7. Strict-Transport-Security — HSTS (opt-in via enableHSTS)
 */
export function setSecurityHeaders(
  res: ServerResponse,
  config: HttpTransportConfig,
): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; frame-ancestors 'none'",
  );
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader("Referrer-Policy", "no-referrer");

  if (config.enableHSTS) {
    const maxAge = config.hstsMaxAge ?? DEFAULT_HSTS_MAX_AGE;
    res.setHeader(
      "Strict-Transport-Security",
      `max-age=${String(maxAge)}; includeSubDomains`,
    );
  }
}

// =============================================================================
// CORS
// =============================================================================

/**
 * Check if an origin matches a CORS pattern.
 * Supports exact match and wildcard subdomain patterns (e.g., `*.example.com`).
 */
export function matchesCorsOrigin(origin: string, pattern: string): boolean {
  if (pattern === origin) return true;
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".example.com"
    return origin.endsWith(suffix) && origin.length > suffix.length;
  }
  return false;
}

/**
 * Set CORS headers for browser-based MCP client support.
 */
export function setCorsHeaders(
  req: IncomingMessage,
  res: ServerResponse,
  config: HttpTransportConfig,
): void {
  const origin = req.headers.origin;
  const allowAll = config.corsOrigins?.includes("*");

  if (allowAll) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (
    origin &&
    config.corsOrigins?.some((p) => matchesCorsOrigin(origin, p))
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    return;
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
  res.setHeader("Access-Control-Max-Age", "86400");

  if (config.corsAllowCredentials && !allowAll) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
}

// =============================================================================
// Body Parsing
// =============================================================================

/**
 * Read and parse JSON body from an incoming request.
 * Returns undefined for GET/DELETE/OPTIONS (no body expected).
 */
export async function readBody(req: IncomingMessage): Promise<unknown> {
  if (
    req.method === "GET" ||
    req.method === "DELETE" ||
    req.method === "OPTIONS"
  ) {
    return undefined;
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON in request body"));
      }
    });
    req.on("error", reject);
  });
}

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { validateAuth, formatOAuthError } from "../../../auth/middleware.js";
import type { AuthenticatedContext } from "../../../auth/middleware.js";
import { logger } from "../../../utils/logger.js";
import type { HttpTransportConfig, RateLimitEntry } from "../types.js";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_MAX_BODY_SIZE,
  HTTP_REQUEST_TIMEOUT_MS,
  HTTP_KEEP_ALIVE_TIMEOUT_MS,
  HTTP_HEADERS_TIMEOUT_MS,
} from "../types.js";
import { SessionManager } from "../session-manager.js";
import { checkRateLimit, setSecurityHeaders, setCorsHeaders } from "../security.js";
import { createClient, type RedisClientType } from "redis";
import {
  handleHealthCheck,
  handleRootInfo,
  handleProtectedResourceMetadata,
} from "../handlers.js";
import { metrics } from "../../../observability/metrics.js";

import { handleStreamableRequest, handleStatelessRequest } from "./streamable.js";
import { handleLegacySSERequest, handleLegacyMessageRequest } from "./sse.js";
import { isPublicPath } from "./utils.js";

/**
 * HTTP Transport for MCP
 *
 * Supports two transport protocols simultaneously:
 * 1. Streamable HTTP (2025-03-26) via `/mcp` — preferred for modern clients
 * 2. Legacy SSE (2024-11-05) via `/sse` + `/messages` — backward compatibility
 */
export class HttpTransport {
  private server: ReturnType<typeof createServer> | null = null;
  private readonly config: HttpTransportConfig;
  private readonly onConnect?: (transport: Transport) => void | Promise<void>;

  /** Session lifecycle manager (supports both transport types) */
  private readonly sessionManager = new SessionManager();

  /** Rate limiting state */
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;
  private redisClient?: RedisClientType;

  constructor(
    config: HttpTransportConfig,
    onConnect?: (transport: Transport) => void | Promise<void>,
  ) {
    this.config = {
      ...config,
      host: config.host ?? "localhost",
      publicPaths: config.publicPaths ?? ["/health", "/.well-known/*"],
      enableRateLimit: config.enableRateLimit ?? true,
      rateLimitWindowMs:
        config.rateLimitWindowMs ?? DEFAULT_RATE_LIMIT_WINDOW_MS,
      rateLimitMaxRequests:
        config.rateLimitMaxRequests ??
        (process.env["MCP_RATE_LIMIT_MAX"]
          ? parseInt(process.env["MCP_RATE_LIMIT_MAX"], 10)
          : DEFAULT_RATE_LIMIT_MAX_REQUESTS),
      maxBodySize: config.maxBodySize ?? DEFAULT_MAX_BODY_SIZE,
      enableHSTS:
        config.enableHSTS ?? process.env["MCP_ENABLE_HSTS"] === "true",
      trustProxy: config.trustProxy ?? false,
      stateless: config.stateless ?? false,
    };
    if (onConnect) {
      this.onConnect = onConnect;
    }
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch((error: unknown) => {
          logger.error("HTTP request handler error", { error: String(error) });
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Internal server error" }));
          }
        });
      });

      // Apply server timeouts (slowloris protection)
      this.server.setTimeout(HTTP_REQUEST_TIMEOUT_MS);
      this.server.keepAliveTimeout = HTTP_KEEP_ALIVE_TIMEOUT_MS;
      this.server.headersTimeout = HTTP_HEADERS_TIMEOUT_MS;

      // Start deterministic rate limit cleanup (every 60s)
      if (this.config.enableRateLimit) {
        this.rateLimitCleanupInterval = setInterval(() => {
          const now = Date.now();
          for (const [ip, entry] of this.rateLimitMap) {
            if (now > entry.resetTime) {
              this.rateLimitMap.delete(ip);
            }
          }
        }, 60_000);
        // Don't block process exit
        this.rateLimitCleanupInterval.unref();
      }

      this.server.on("error", reject);

      this.server.listen(this.config.port, this.config.host, () => {
        logger.info(
          `HTTP transport listening on ${this.config.host ?? "localhost"}:${String(this.config.port)} (stateless: ${String(this.config.stateless)})`,
        );
        if (!this.config.stateless) {
          this.sessionManager.startSweep();
        }
        
        if (process.env["REDIS_URL"]) {
          this.redisClient = createClient({ url: process.env["REDIS_URL"] });
          this.redisClient.connect().catch((err: unknown) => {
            logger.error("Redis connection failed in HttpTransport", {
              error: err instanceof Error ? err : new Error(String(err)),
            });
          });
        }
        
        resolve();
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (this.rateLimitCleanupInterval) {
      clearInterval(this.rateLimitCleanupInterval);
      this.rateLimitCleanupInterval = null;
    }

    if (this.redisClient?.isOpen) {
      this.redisClient.destroy();
    }

    await this.sessionManager.closeAll();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info("HTTP transport stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // ===========================================================================
  // Request Handling
  // ===========================================================================

  /**
   * Handle incoming HTTP request
   */
  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Set security headers for all responses
    setSecurityHeaders(res, this.config);

    // Set CORS headers
    setCorsHeaders(req, res, this.config);

    // Handle preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );

    // Handle well-known endpoints
    if (url.pathname === "/.well-known/oauth-protected-resource") {
      handleProtectedResourceMetadata(res, this.config);
      return;
    }

    // Health check — bypasses rate limiting so monitoring probes always succeed
    if (url.pathname === "/health") {
      handleHealthCheck(res, this.config, this.sessionManager.size);
      return;
    }

    // Metrics export
    if (url.pathname === "/metrics" && this.config.metricsExport === "prometheus") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(metrics.toPrometheus());
      return;
    }

    // Root info endpoint
    if (url.pathname === "/" && req.method === "GET") {
      handleRootInfo(res);
      return;
    }

    // =========================================================================
    // Authentication: Simple Bearer Token (lighter-weight alternative to OAuth)
    // =========================================================================
    if (this.config.authToken && !this.config.resourceServer) {
      if (!isPublicPath(url.pathname, this.config.publicPaths)) {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate": 'Bearer realm="mysql-mcp"',
          });
          res.end(
            JSON.stringify({
              error: "unauthorized",
              error_description: "Bearer token required",
            }),
          );
          return;
        }
        const token = authHeader.slice(7);
        if (token !== this.config.authToken) {
          res.writeHead(401, {
            "Content-Type": "application/json",
            "WWW-Authenticate":
              'Bearer realm="mysql-mcp", error="invalid_token"',
          });
          res.end(
            JSON.stringify({
              error: "unauthorized",
              error_description: "Invalid bearer token",
            }),
          );
          return;
        }
      }
    }

    // Check rate limit (after health check bypass)
    const rateLimitResult = await checkRateLimit(req, this.config, this.rateLimitMap, this.redisClient);
    if (!rateLimitResult.allowed) {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (rateLimitResult.retryAfterSeconds !== undefined) {
        headers["Retry-After"] = String(rateLimitResult.retryAfterSeconds);
      }
      res.writeHead(429, headers);
      res.end(
        JSON.stringify({
          error: "rate_limit_exceeded",
          error_description: "Too many requests. Please try again later.",
        }),
      );
      return;
    }

    // Check body size — two-layer enforcement
    const maxBodySize = this.config.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
    const contentLength = parseInt(req.headers["content-length"] ?? "0", 10);
    if (contentLength > maxBodySize) {
      res.writeHead(413, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "payload_too_large",
          error_description: `Request body exceeds maximum size of ${String(maxBodySize)} bytes.`,
        }),
      );
      return;
    }

    // Streaming body size enforcement removed because it causes premature consumption of the stream 
    // before the async validateAuth completes, causing stateless mode to hang.

    // Authenticate if OAuth is configured and path is not public
    let authContext: AuthenticatedContext | undefined;
    if (this.config.resourceServer && this.config.tokenValidator) {
      if (!isPublicPath(url.pathname, this.config.publicPaths)) {
        try {
          authContext = await validateAuth(req.headers.authorization, {
            tokenValidator: this.config.tokenValidator,
            required: true,
          });
        } catch (error) {
          const { status, body } = formatOAuthError(error);
          res.writeHead(status, {
            "Content-Type": "application/json",
            "WWW-Authenticate": "Bearer",
          });
          res.end(JSON.stringify(body));
          return;
        }
      }
    }

    // =========================================================================
    // Streamable HTTP Transport (Protocol 2025-03-26)
    // =========================================================================
    if (url.pathname === "/mcp") {
      if (this.config.stateless) {
        await handleStatelessRequest(req, res, authContext, this.onConnect);
      } else {
        await handleStreamableRequest(req, res, this.sessionManager, authContext, this.onConnect);
      }
      return;
    }

    // =========================================================================
    // Legacy SSE Transport (Protocol 2024-11-05)
    // =========================================================================
    if (url.pathname === "/sse") {
      if (this.config.stateless) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      await handleLegacySSERequest(req, res, this.sessionManager, this.onConnect);
      return;
    }

    if (url.pathname === "/messages") {
      if (this.config.stateless) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      await handleLegacyMessageRequest(req, res, url, this.sessionManager, authContext);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Get all active transports (for testing/introspection)
   */
  getTransports(): Map<
    string,
    StreamableHTTPServerTransport | 
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    SSEServerTransport
  > {
    return this.sessionManager.getTransports();
  }
}

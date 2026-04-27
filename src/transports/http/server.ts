/**
 * mysql-mcp - HTTP Transport Server
 *
 * Dual-protocol HTTP transport with backward compatibility:
 * - `/mcp` — Streamable HTTP transport (MCP protocol 2025-03-26)
 * - `/sse` + `/messages` — Legacy SSE transport (MCP protocol 2024-11-05)
 *
 * Includes OAuth 2.1 support, rate limiting, CORS, and security headers.
 */
/* eslint-disable @typescript-eslint/no-deprecated -- Intentional: SSEServerTransport provides backward compatibility for MCP 2024-11-05 clients */

import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { validateAuth, formatOAuthError } from "../../auth/middleware.js";
import type { AuthenticatedContext } from "../../auth/middleware.js";
import { getRequiredScope } from "../../auth/scope-map.js";
import { hasScope } from "../../auth/scopes.js";
import { InsufficientScopeError } from "../../auth/errors.js";
import { logger } from "../../utils/logger.js";
import type { HttpTransportConfig, RateLimitEntry } from "./types.js";
import {
  DEFAULT_RATE_LIMIT_WINDOW_MS,
  DEFAULT_RATE_LIMIT_MAX_REQUESTS,
  DEFAULT_MAX_BODY_SIZE,
  HTTP_REQUEST_TIMEOUT_MS,
  HTTP_KEEP_ALIVE_TIMEOUT_MS,
  HTTP_HEADERS_TIMEOUT_MS,
} from "./types.js";
import {
  checkRateLimit,
  setSecurityHeaders,
  setCorsHeaders,
  readBody,
} from "./security.js";
import {
  handleHealthCheck,
  handleRootInfo,
  handleProtectedResourceMetadata,
} from "./handlers.js";

// =============================================================================
// HTTP Transport Class
// =============================================================================

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

  /** Active transports by session ID (supports both transport types) */
  private readonly transports = new Map<
    string,
    StreamableHTTPServerTransport | SSEServerTransport
  >();

  /** Rate limiting state */
  private readonly rateLimitMap = new Map<string, RateLimitEntry>();
  private rateLimitCleanupInterval: NodeJS.Timeout | null = null;

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
          `HTTP transport listening on ${this.config.host ?? "localhost"}:${String(this.config.port)}`,
        );
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

    for (const [sessionId, transport] of this.transports) {
      try {
        await transport.close();
      } catch {
        logger.warn("Error closing transport during shutdown", { sessionId });
      }
    }
    this.transports.clear();

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
   * Check if a path is public (bypasses authentication)
   */
  private isPublicPath(pathname: string): boolean {
    const publicPaths = this.config.publicPaths ?? [];
    for (const pattern of publicPaths) {
      if (pattern.endsWith("/*")) {
        const prefix = pattern.slice(0, -2);
        if (pathname.startsWith(prefix)) return true;
      } else if (pattern === pathname) {
        return true;
      }
    }
    return false;
  }

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
      handleHealthCheck(res, this.config);
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
      if (!this.isPublicPath(url.pathname)) {
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
    const rateLimitResult = checkRateLimit(req, this.config, this.rateLimitMap);
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

    // Streaming body size enforcement
    let receivedBytes = 0;
    let bodyLimitExceeded = false;
    if (typeof req.on === "function") {
      req.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
        if (receivedBytes > maxBodySize && !bodyLimitExceeded) {
          bodyLimitExceeded = true;
          req.destroy();
          if (!res.headersSent) {
            res.writeHead(413, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                error: "payload_too_large",
                error_description: `Request body exceeds maximum size of ${String(maxBodySize)} bytes.`,
              }),
            );
          }
        }
      });
    }

    if (bodyLimitExceeded) return;

    // Authenticate if OAuth is configured and path is not public
    let authContext: AuthenticatedContext | undefined;
    if (this.config.resourceServer && this.config.tokenValidator) {
      if (!this.isPublicPath(url.pathname)) {
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
        await this.handleStatelessRequest(req, res, authContext);
      } else {
        await this.handleStreamableRequest(req, res, authContext);
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
      await this.handleLegacySSERequest(req, res);
      return;
    }

    if (url.pathname === "/messages") {
      if (this.config.stateless) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
        return;
      }
      await this.handleLegacyMessageRequest(req, res, url, authContext);
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }

  // ===========================================================================
  // Authorization
  // ===========================================================================

  /**
   * Check if the authenticated context has the required scope for a tool call.
   * Returns true if authorized, false if unauthorized (and sends response).
   */
  private checkToolScope(
    body: unknown,
    authContext: AuthenticatedContext,
    res: ServerResponse,
  ): boolean {
    interface JsonRpcBody {
      method?: string;
      params?: { name?: string };
    }
    const jsonBody = body as JsonRpcBody | null | undefined;

    if (jsonBody?.method === "tools/call") {
      const toolName = jsonBody.params?.name;
      if (toolName) {
        const requiredScope = getRequiredScope(toolName);
        const granted = hasScope(authContext.scopes, requiredScope);

        if (!granted) {
          const error = new InsufficientScopeError([requiredScope]);
          logger.warn(`Insufficient scope for tool: ${toolName}`, {
            module: "AUTH",
            operation: "scope-check",
            entityId: toolName,
          });
          const { status, body: errBody } = formatOAuthError(error);
          res.writeHead(status, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ...errBody, tool: toolName }));
          return false;
        }
      }
    }
    return true;
  }

  // ===========================================================================
  // Streamable HTTP Transport (Protocol 2025-03-26)
  // ===========================================================================

  private async handleStreamableRequest(
    req: IncomingMessage,
    res: ServerResponse,
    authContext?: AuthenticatedContext,
  ): Promise<void> {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (req.method !== "POST") {
      if (sessionId && this.transports.has(sessionId)) {
        const existing = this.transports.get(sessionId);
        if (existing instanceof StreamableHTTPServerTransport) {
          await existing.handleRequest(req, res);
          return;
        }
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        }),
      );
      return;
    }

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error: Invalid JSON" },
          id: null,
        }),
      );
      return;
    }

    if (authContext && !this.checkToolScope(body, authContext, res)) {
      return;
    }

    if (sessionId && this.transports.has(sessionId)) {
      const existing = this.transports.get(sessionId);
      if (existing instanceof StreamableHTTPServerTransport) {
        await existing.handleRequest(req, res, body);
        return;
      }
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message:
              "Bad Request: Session exists but uses a different transport protocol",
          },
          id: null,
        }),
      );
      return;
    }

    if (!sessionId && isInitializeRequest(body)) {
      const newTransport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (newSessionId: string) => {
          logger.debug("Streamable HTTP session initialized", {
            sessionId: newSessionId,
          });
          this.transports.set(newSessionId, newTransport);
        },
      });

      newTransport.onclose = () => {
        const sid = newTransport.sessionId;
        if (sid && this.transports.has(sid)) {
          logger.debug("Streamable HTTP transport closed", {
            sessionId: sid,
          });
          this.transports.delete(sid);
        }
      };

      if (this.onConnect) {
        await this.onConnect(newTransport);
      }

      await newTransport.handleRequest(req, res, body);
      return;
    }

    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      }),
    );
  }

  // ===========================================================================
  // Stateless HTTP Mode
  // ===========================================================================

  /**
   * Handle stateless HTTP requests on `/mcp`.
   *
   * Each request creates a fresh transport — no sessions, no SSE stream.
   * Only POST is supported; GET (SSE) and DELETE (terminate) return errors.
   */
  private async handleStatelessRequest(
    req: IncomingMessage,
    res: ServerResponse,
    authContext?: AuthenticatedContext,
  ): Promise<void> {
    if (req.method === "GET") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: {
            message: "SSE connections not available in stateless mode",
          },
        }),
      );
      return;
    }

    if (req.method === "DELETE") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method !== "POST") {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: "Method not allowed" } }));
      return;
    }

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error: Invalid JSON" },
          id: null,
        }),
      );
      return;
    }

    if (authContext && !this.checkToolScope(body, authContext, res)) {
      return;
    }

    const transport = new StreamableHTTPServerTransport({});

    if (this.onConnect) {
      await this.onConnect(transport);
    }

    await transport.handleRequest(req, res, body);
    await transport.close();
  }

  // ===========================================================================
  // Legacy SSE Transport (Protocol 2024-11-05)
  // ===========================================================================

  private async handleLegacySSERequest(
    _req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    logger.debug("Legacy SSE connection established");

    const transport = new SSEServerTransport("/messages", res);
    this.transports.set(transport.sessionId, transport);

    res.on("close", () => {
      logger.debug("Legacy SSE transport closed", {
        sessionId: transport.sessionId,
      });
      this.transports.delete(transport.sessionId);
    });

    // Connect MCP server to this transport (must complete before client sends messages)
    if (this.onConnect) {
      await this.onConnect(transport);
    }
  }

  private async handleLegacyMessageRequest(
    req: IncomingMessage,
    res: ServerResponse,
    url: URL,
    authContext?: AuthenticatedContext,
  ): Promise<void> {
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId parameter" }));
      return;
    }

    const transport = this.transports.get(sessionId);

    if (!transport) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "No transport found for sessionId" }));
      return;
    }

    if (!(transport instanceof SSEServerTransport)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error:
            "Session exists but uses a different transport protocol. Use /mcp instead.",
        }),
      );
      return;
    }

    let body: unknown;
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Parse error: Invalid JSON" }));
      return;
    }

    if (authContext && !this.checkToolScope(body, authContext, res)) {
      return;
    }

    await transport.handlePostMessage(req, res, body);
  }

  // ===========================================================================
  // Accessors
  // ===========================================================================

  /**
   * Get all active transports (for testing/introspection)
   */
  getTransports(): Map<
    string,
    StreamableHTTPServerTransport | SSEServerTransport
  > {
    return this.transports;
  }
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(
  config: HttpTransportConfig,
  onConnect?: (transport: Transport) => void | Promise<void>,
): HttpTransport {
  return new HttpTransport(config, onConnect);
}

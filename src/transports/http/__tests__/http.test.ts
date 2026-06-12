/**
 * mysql-mcp - HTTP Transport Unit Tests
 *
 * Tests for HTTP transport functionality including CORS,
 * health checks, OAuth metadata, request routing, dual-transport
 * support (Streamable HTTP + Legacy SSE), rate limiting, body
 * size enforcement, and security headers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpTransport, createHttpTransport } from "../server/index.js";
import {
  setSecurityHeaders,
  setCorsHeaders,
  checkRateLimit,
  readBody,
  getClientIp,
  getSafeCorsOrigin,
} from "../security.js";
import {
  handleHealthCheck,
  handleProtectedResourceMetadata,
} from "../handlers.js";
import type { HttpTransportConfig, RateLimitEntry } from "../types.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";
import { PassThrough } from "node:stream";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Mock node:http
vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn((_port: number, _host: string, cb: () => void) => cb()),
    close: vi.fn((cb?: () => void) => cb && cb()),
    on: vi.fn(),
    setTimeout: vi.fn(),
    keepAliveTimeout: 0,
    headersTimeout: 0,
  };
  return {
    createServer: vi.fn(() => mockServer),
    IncomingMessage: vi.fn(),
    ServerResponse: vi.fn(),
  };
});

// Mock SDK StreamableHTTPServerTransport
vi.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => {
  return {
    StreamableHTTPServerTransport: vi.fn(function () {
      return {
        handleRequest: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        sessionId: "mock-session-id",
        onclose: null,
      };
    }),
  };
});

vi.mock("@modelcontextprotocol/sdk/server/sse.js", () => {
  return {
    SSEServerTransport: vi.fn(function (
      this: any,
      _path: string,
      _res: ServerResponse,
    ) {
      this.handlePostMessage = vi.fn().mockResolvedValue(undefined);
      this.close = vi.fn().mockResolvedValue(undefined);
      this.sessionId = `sse-session-${Date.now()}`;
    }),
  };
});

// Mock SDK types
vi.mock("@modelcontextprotocol/sdk/types.js", () => {
  return {
    isInitializeRequest: vi.fn((body: unknown) => {
      if (body && typeof body === "object" && "method" in body) {
        return (body as { method: string }).method === "initialize";
      }
      return false;
    }),
  };
});

// Mock logger to avoid console output
vi.mock("../../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * Helper to create a mock IncomingMessage for handleRequest
 */
function createMockRequest(
  overrides: Partial<IncomingMessage> & { url?: string; method?: string } = {},
): IncomingMessage {
  return {
    method: "GET",
    url: "/",
    headers: { host: "localhost:3000" },
    socket: { remoteAddress: "127.0.0.1" },
    ...overrides,
  } as unknown as IncomingMessage;
}

/**
 * Helper to create a mock ServerResponse
 */
function createMockResponse(): ServerResponse {
  return {
    writeHead: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
    headersSent: false,
    on: vi.fn(),
  } as unknown as ServerResponse;
}

// =============================================================================
// Standalone Security Functions
// =============================================================================

describe("getClientIp()", () => {
  it("should return socket address when trustProxy is disabled", async () => {
    const req = createMockRequest({
      headers: { "x-forwarded-for": "1.2.3.4" },
    });
    expect(getClientIp(req, false)).toBe("127.0.0.1");
  });

  it("should return X-Forwarded-For when trustProxy is enabled", async () => {
    const req = createMockRequest({
      headers: { host: "localhost", "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIp(req, true)).toBe("1.2.3.4");
  });

  it("should fall back to socket address when no X-Forwarded-For", async () => {
    const req = createMockRequest();
    expect(getClientIp(req, true)).toBe("127.0.0.1");
  });
});

describe("getSafeCorsOrigin()", () => {
  it("should match exact origins", async () => {
    expect(
      getSafeCorsOrigin("https://example.com", "https://example.com"),
    ).toBe("https://example.com");
  });

  it("should not match different origins", async () => {
    expect(
      getSafeCorsOrigin("https://evil.com", "https://example.com"),
    ).toBeNull();
  });

  it("should match wildcard subdomain patterns", async () => {
    expect(getSafeCorsOrigin("https://app.example.com", "*.example.com")).toBe(
      "https://app.example.com",
    );
  });

  it("should not match bare domain against wildcard subdomain", async () => {
    expect(
      getSafeCorsOrigin("https://example.com", "*.example.com"),
    ).toBeNull();
  });
});

describe("checkRateLimit()", () => {
  it("should allow requests when rate limiting disabled", async () => {
    const config: HttpTransportConfig = { port: 3000, enableRateLimit: false };
    const map = new Map<string, RateLimitEntry>();
    const req = createMockRequest();
    expect((await checkRateLimit(req, config, map)).allowed).toBe(true);
  });

  it("should block after max requests and return retryAfterSeconds", async () => {
    const config: HttpTransportConfig = {
      port: 3000,
      enableRateLimit: true,
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 60000,
    };
    const map = new Map<string, RateLimitEntry>();
    const req = createMockRequest();

    const r1 = await checkRateLimit(req, config, map);
    expect(r1.allowed).toBe(true);

    const r2 = await checkRateLimit(req, config, map);
    expect(r2.allowed).toBe(false);
    expect(r2.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("should use Redis when available", async () => {
    const config: HttpTransportConfig = {
      port: 3000,
      enableRateLimit: true,
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 60000,
    };
    const map = new Map<string, RateLimitEntry>();
    const req = createMockRequest();
    
    const mockRedisClient = {
      isOpen: true,
      incr: vi.fn().mockResolvedValue(1),
      pExpire: vi.fn().mockResolvedValue(true),
      pTTL: vi.fn().mockResolvedValue(50000),
    };

    const r1 = await checkRateLimit(req, config, map, mockRedisClient as any);
    expect(r1.allowed).toBe(true);
    expect(mockRedisClient.incr).toHaveBeenCalledWith("http:rl:127.0.0.1");
    expect(mockRedisClient.pExpire).toHaveBeenCalledWith("http:rl:127.0.0.1", 60000);
  });

  it("should fallback to memory when Redis fails", async () => {
    const config: HttpTransportConfig = {
      port: 3000,
      enableRateLimit: true,
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 60000,
    };
    const map = new Map<string, RateLimitEntry>();
    const req = createMockRequest();
    
    const mockRedisClient = {
      isOpen: true,
      incr: vi.fn().mockRejectedValue(new Error("Redis error")),
      pExpire: vi.fn(),
      pTTL: vi.fn(),
    };

    const r1 = await checkRateLimit(req, config, map, mockRedisClient as any);
    expect(r1.allowed).toBe(true); // Should fallback to memory map (which is empty) and allow
  });
});

describe("setSecurityHeaders()", () => {
  it("should set 6 base headers (HSTS disabled)", async () => {
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = { port: 3000, enableHSTS: false };
    setSecurityHeaders(mockRes, config);

    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "X-Content-Type-Options",
      "nosniff",
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, no-cache, must-revalidate",
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Referrer-Policy",
      "no-referrer",
    );
    // 6 headers total
    expect(mockRes.setHeader).toHaveBeenCalledTimes(6);
  });

  it("should include HSTS header when enabled (7 total)", async () => {
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = { port: 3000, enableHSTS: true };
    setSecurityHeaders(mockRes, config);

    expect(mockRes.setHeader).toHaveBeenCalledTimes(7);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Strict-Transport-Security",
      expect.stringContaining("max-age="),
    );
  });
});

describe("setCorsHeaders()", () => {
  it("should not set CORS headers when origin not in allowed list", async () => {
    const mockReq = createMockRequest({
      headers: { origin: "https://notallowed.example.com" },
    });
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = {
      port: 3000,
      corsOrigins: ["https://allowed.example.com"],
    };

    setCorsHeaders(mockReq, mockRes, config);
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });

  it("should set CORS headers when origin is allowed", async () => {
    const mockReq = createMockRequest({
      headers: { origin: "https://allowed.example.com" },
    });
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = {
      port: 3000,
      corsOrigins: ["https://allowed.example.com"],
    };

    setCorsHeaders(mockReq, mockRes, config);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://allowed.example.com",
    );
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Methods",
      "GET, POST, DELETE, OPTIONS",
    );
  });

  it("should not set CORS when no origin header", async () => {
    const mockReq = createMockRequest({ headers: {} });
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = {
      port: 3000,
      corsOrigins: ["https://allowed.example.com"],
    };

    setCorsHeaders(mockReq, mockRes, config);
    expect(mockRes.setHeader).not.toHaveBeenCalled();
  });

  it("should set credentials header when configured", async () => {
    const mockReq = createMockRequest({
      headers: { origin: "https://allowed.example.com" },
    });
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = {
      port: 3000,
      corsOrigins: ["https://allowed.example.com"],
      corsAllowCredentials: true,
    };

    setCorsHeaders(mockReq, mockRes, config);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Credentials",
      "true",
    );
  });

  it("should match wildcard subdomain origin", async () => {
    const mockReq = createMockRequest({
      headers: { origin: "https://app.example.com" },
    });
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = {
      port: 3000,
      corsOrigins: ["*.example.com"],
    };

    setCorsHeaders(mockReq, mockRes, config);
    expect(mockRes.setHeader).toHaveBeenCalledWith(
      "Access-Control-Allow-Origin",
      "https://app.example.com",
    );
  });
});

describe("readBody()", () => {
  it("should return undefined for GET requests", async () => {
    const mockReq = createMockRequest({ method: "GET" });
    const result = await readBody(mockReq);
    expect(result).toBeUndefined();
  });

  it("should return undefined for DELETE requests", async () => {
    const mockReq = createMockRequest({ method: "DELETE" });
    const result = await readBody(mockReq);
    expect(result).toBeUndefined();
  });

  it("should return undefined for OPTIONS requests", async () => {
    const mockReq = createMockRequest({ method: "OPTIONS" });
    const result = await readBody(mockReq);
    expect(result).toBeUndefined();
  });
});

// =============================================================================
// Standalone Handler Functions
// =============================================================================

describe("handleHealthCheck()", () => {
  it("should return healthy status", async () => {
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = { port: 3000 };
    handleHealthCheck(mockRes, config);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json",
    });

    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const response = JSON.parse(endCall as string);
    expect(response).toHaveProperty("status", "healthy");
    expect(response).toHaveProperty("timestamp");
  });

  it("should include ISO timestamp", async () => {
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = { port: 3000 };
    handleHealthCheck(mockRes, config);

    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const response = JSON.parse(endCall as string);
    expect(() => new Date(response.timestamp as string)).not.toThrow();
  });
});

describe("handleProtectedResourceMetadata()", () => {
  it("should return 404 when OAuth not configured", async () => {
    const mockRes = createMockResponse();
    const config: HttpTransportConfig = { port: 3000 };
    handleProtectedResourceMetadata(mockRes, config);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404);
    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const response = JSON.parse(endCall as string);
    expect(response).toHaveProperty("error");
  });

  it("should return metadata when OAuth configured", async () => {
    const mockResourceServer = {
      getMetadata: () => ({
        resource: "https://mysql-mcp.example.com",
        authorization_servers: ["https://auth.example.com"],
        scopes_supported: ["read", "write"],
      }),
    };

    const mockRes = createMockResponse();
    const config: HttpTransportConfig = {
      port: 3000,
      resourceServer: mockResourceServer as never,
    };
    handleProtectedResourceMetadata(mockRes, config);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json",
    });

    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const response = JSON.parse(endCall as string);
    expect(response).toHaveProperty("resource");
    expect(response).toHaveProperty("authorization_servers");
  });
});

// =============================================================================
// HttpTransport Class Tests
// =============================================================================

describe("HttpTransport", () => {
  let transport: HttpTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new HttpTransport({
      port: 3000,
      host: "localhost",
    });
  });

  describe("Lifecycle", () => {
    it("should start server on start()", async () => {
      await transport.start();
      expect(createServer).toHaveBeenCalled();
      const server = (createServer as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(server.listen).toHaveBeenCalledWith(
        3000,
        "localhost",
        expect.any(Function),
      );
      expect(server.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should apply server timeouts on start()", async () => {
      await transport.start();
      const server = (createServer as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(server.setTimeout).toHaveBeenCalledWith(120_000);
      expect(server.keepAliveTimeout).toBe(65_000);
      expect(server.headersTimeout).toBe(66_000);
    });

    it("should stop server on stop()", async () => {
      await transport.start();
      await transport.stop();
      const server = (createServer as ReturnType<typeof vi.fn>).mock.results[0]
        .value;
      expect(server.close).toHaveBeenCalled();
    });

    it("should do nothing on stop() if not started", async () => {
      const result = await transport.stop();
      expect(result).toBeUndefined();
    });

    it("should close all transports on stop()", async () => {
      const mockT1 = { close: vi.fn().mockResolvedValue(undefined) };
      const mockT2 = { close: vi.fn().mockResolvedValue(undefined) };
      (transport as any).sessionManager.register("session-1", mockT1 as never);
      (transport as any).sessionManager.register("session-2", mockT2 as never);

      await transport.stop();

      expect(mockT1.close).toHaveBeenCalled();
      expect(mockT2.close).toHaveBeenCalled();
      expect((transport as any).sessionManager.size).toBe(0);
    });

    it("should handle close errors gracefully during stop()", async () => {
      const mockT = {
        close: vi.fn().mockRejectedValue(new Error("close error")),
      };
      (transport as any).sessionManager.register("session-err", mockT as never);

      await transport.stop();
      expect((transport as any).sessionManager.size).toBe(0);
    });
  });

  describe("Construction", () => {
    it("should create transport with config", async () => {
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it("should use default host when not provided", async () => {
      const t = new HttpTransport({ port: 8080 });
      expect(t).toBeInstanceOf(HttpTransport);
    });

    it("should apply default configuration values", async () => {
      const t = new HttpTransport({ port: 3000 });
      expect(t).toBeInstanceOf(HttpTransport);
    });
  });
});

// =============================================================================
// handleRequest() Integration Tests
// =============================================================================

describe("handleRequest()", () => {
  let transport: HttpTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new HttpTransport({
      port: 3000,
      corsOrigins: ["https://example.com"],
    });
  });

  it("should handle OPTIONS preflight request", async () => {
    const mockReq = createMockRequest({
      method: "OPTIONS",
      url: "/mcp",
      headers: { host: "localhost:3000", origin: "https://example.com" },
    });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(204);
    expect(mockRes.end).toHaveBeenCalled();
  });

  it("should route to health check endpoint", async () => {
    const mockReq = createMockRequest({ method: "GET", url: "/health" });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json",
    });
    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(JSON.parse(endCall as string)).toHaveProperty("status", "healthy");
  });

  it("should route to OAuth metadata endpoint", async () => {
    const mockReq = createMockRequest({
      method: "GET",
      url: "/.well-known/oauth-protected-resource",
    });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404);
  });

  it("should return 404 for unknown paths", async () => {
    const mockReq = createMockRequest({
      method: "GET",
      url: "/unknown-path",
    });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(404);
    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(JSON.parse(endCall as string)).toHaveProperty("error", "Not found");
  });

  it("should reject unauthenticated requests when OAuth is configured", async () => {
    const mockTokenValidator = {
      validate: vi
        .fn()
        .mockResolvedValue({ valid: false, error: "Token missing" }),
    };

    const mockResourceServer = {
      getMetadata: vi.fn().mockReturnValue({ resource: "test" }),
    };

    const transportWithOAuth = new HttpTransport({
      port: 3000,
      resourceServer: mockResourceServer as never,
      tokenValidator: mockTokenValidator as never,
    });

    const mockReq = createMockRequest({ method: "GET", url: "/mcp" });
    const mockRes = createMockResponse();

    await (
      transportWithOAuth as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(
      401,
      expect.objectContaining({
        "WWW-Authenticate": "Bearer",
      }),
    );
  });

  it("should return 429 with Retry-After when rate limited", async () => {
    const rateLimitedTransport = new HttpTransport({
      port: 3000,
      enableRateLimit: true,
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 60000,
    });

    // Use /mcp, not /health (health bypasses rate limiting)
    const mockReq = createMockRequest({ method: "GET", url: "/mcp" });
    const mockRes1 = createMockResponse();
    const mockRes2 = createMockResponse();

    const handleRequest = (
      rateLimitedTransport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest.bind(rateLimitedTransport);

    // First request consumes the quota
    await handleRequest(mockReq, mockRes1);

    // Second request should be rate limited with Retry-After
    await handleRequest(mockReq, mockRes2);
    expect(mockRes2.writeHead).toHaveBeenCalledWith(
      429,
      expect.objectContaining({
        "Content-Type": "application/json",
        "Retry-After": expect.any(String),
      }),
    );
  });

  it("should allow /health even when rate limited", async () => {
    const rateLimitedTransport = new HttpTransport({
      port: 3000,
      enableRateLimit: true,
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 60000,
    });

    const handleRequest = (
      rateLimitedTransport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest.bind(rateLimitedTransport);

    // Exhaust rate limit with /mcp
    const mcpReq = createMockRequest({ method: "GET", url: "/mcp" });
    await handleRequest(mcpReq, createMockResponse());

    // Health should still respond 200
    const healthReq = createMockRequest({ method: "GET", url: "/health" });
    const healthRes = createMockResponse();
    await handleRequest(healthReq, healthRes);
    expect(healthRes.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it("should reject oversized Content-Length", async () => {
    const mockReq = createMockRequest({
      method: "POST",
      url: "/mcp",
      headers: {
        host: "localhost:3000",
        "content-length": "999999999",
      },
    });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(413, {
      "Content-Type": "application/json",
    });
  });

  it("should dispatch to /mcp for Streamable HTTP", async () => {
    const mockReq = createMockRequest({ method: "GET", url: "/mcp" });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    // GET /mcp without session ID → 400 (no valid session)
    expect(mockRes.writeHead).toHaveBeenCalledWith(400, {
      "Content-Type": "application/json",
    });
  });

  it("should dispatch to /sse for Legacy SSE", async () => {
    const onConnect = vi.fn();
    const t = new HttpTransport({ port: 3000 }, onConnect);

    const mockReq = createMockRequest({ method: "GET", url: "/sse" });
    const mockRes = createMockResponse();

    await (
      t as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(onConnect).toHaveBeenCalled();
    expect(t.getTransports().size).toBe(1);
  });

  it("should dispatch to /messages for legacy message routing", async () => {
    const mockReq = createMockRequest({
      method: "POST",
      url: "/messages?sessionId=nonexistent",
    });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    // No transport for this session → 404
    expect(mockRes.writeHead).toHaveBeenCalledWith(404, {
      "Content-Type": "application/json",
    });
  });

  it("should return 400 for /messages without sessionId", async () => {
    const mockReq = createMockRequest({
      method: "POST",
      url: "/messages",
    });
    const mockRes = createMockResponse();

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(400, {
      "Content-Type": "application/json",
    });
    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(JSON.parse(endCall as string)).toHaveProperty(
      "error",
      "Missing sessionId parameter",
    );
  });

  describe("OAuth Scope Enforcement", () => {
    it("should allow tools/call if auth context has required scope", async () => {
      const mockTokenValidator = {
        validate: vi.fn().mockResolvedValue({
          valid: true,
          claims: { scopes: ["write"] }, // mysql_read_query requires 'write'
        }),
      };
      const mockResourceServer = {
        getMetadata: vi.fn().mockReturnValue({ resource: "test" }),
      };

      const t = new HttpTransport({
        port: 3000,
        resourceServer: mockResourceServer as never,
        tokenValidator: mockTokenValidator as never,
      });

      const mockTransport = new SSEServerTransport(
        "/messages",
        createMockResponse(),
      );
      (t as any).sessionManager.register("mock-session", mockTransport as never);

      const mockReqStream = new PassThrough();
      const mockReq = mockReqStream as unknown as IncomingMessage;
      mockReq.method = "POST";
      mockReq.url = "/messages?sessionId=mock-session";
      mockReq.headers = {
        host: "localhost:3000",
        authorization: "Bearer token",
      };
      (mockReq as any).socket = { remoteAddress: "127.0.0.1" };

      mockReqStream.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "mysql_read_query", arguments: { sql: "SELECT 1" } },
        }),
      );
      mockReqStream.end();

      const mockRes = createMockResponse();

      await (t as any).handleRequest(mockReq, mockRes);

      expect(mockRes.writeHead).not.toHaveBeenCalled();
      expect(mockTransport.handlePostMessage).toHaveBeenCalled();
    });

    it("should block tools/call with 403 if missing required scope", async () => {
      const mockTokenValidator = {
        validate: vi.fn().mockResolvedValue({
          valid: true,
          claims: { scopes: ["read"] }, // Missing 'write' scope
        }),
      };
      const mockResourceServer = {
        getMetadata: vi.fn().mockReturnValue({ resource: "test" }),
      };

      const t = new HttpTransport({
        port: 3000,
        resourceServer: mockResourceServer as never,
        tokenValidator: mockTokenValidator as never,
      });

      const mockTransport = new SSEServerTransport(
        "/messages",
        createMockResponse(),
      );
      (t as any).sessionManager.register("mock-session", mockTransport as never);

      const mockReqStream = new PassThrough();
      const mockReq = mockReqStream as unknown as IncomingMessage;
      mockReq.method = "POST";
      mockReq.url = "/messages?sessionId=mock-session";
      mockReq.headers = {
        host: "localhost:3000",
        authorization: "Bearer token",
      };
      (mockReq as any).socket = { remoteAddress: "127.0.0.1" };

      mockReqStream.write(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name: "mysql_read_query", arguments: { sql: "SELECT 1" } },
        }),
      );
      mockReqStream.end();

      const mockRes = createMockResponse();

      await (t as any).handleRequest(mockReq, mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(
        403,
        expect.objectContaining({
          "Content-Type": "application/json",
        }),
      );
      const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const responseBody = JSON.parse(endCall as string);

      expect(responseBody).toHaveProperty("error", "insufficient_scope");
      expect(responseBody).toHaveProperty("error_description");
      expect(responseBody.error_description).toContain("Insufficient scope");
      expect(responseBody).toHaveProperty("tool", "mysql_read_query");
      expect(mockTransport.handlePostMessage).not.toHaveBeenCalled();
    });
  });
});

// =============================================================================
// Accessors & Factory
// =============================================================================

describe("getTransports()", () => {
  it("should return the transport map", async () => {
    const transport = new HttpTransport({ port: 3000 });
    const map = transport.getTransports();
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });
});

describe("createHttpTransport()", () => {
  it("should create HttpTransport instance", async () => {
    const transport = createHttpTransport({ port: 8080 });
    expect(transport).toBeInstanceOf(HttpTransport);
  });

  it("should pass config to transport", async () => {
    const transport = createHttpTransport({
      port: 3000,
      host: "0.0.0.0",
      corsOrigins: ["https://example.com"],
    });
    expect(transport).toBeInstanceOf(HttpTransport);
  });

  it("should accept onConnect callback", async () => {
    const onConnect = vi.fn();
    const transport = createHttpTransport({ port: 3000 }, onConnect);
    expect(transport).toBeInstanceOf(HttpTransport);
  });
});

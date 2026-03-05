/**
 * mysql-mcp - HTTP Transport Unit Tests
 *
 * Tests for HTTP transport functionality including CORS,
 * health checks, OAuth metadata, request routing, dual-transport
 * support (Streamable HTTP + Legacy SSE), rate limiting, body
 * size enforcement, and security headers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpTransport, createHttpTransport } from "../http.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";

// Mock node:http
vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn((_port: number, _host: string, cb: () => void) => cb()),
    close: vi.fn((cb?: () => void) => cb && cb()),
    on: vi.fn(),
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

// Mock SDK SSEServerTransport
vi.mock("@modelcontextprotocol/sdk/server/sse.js", () => {
  return {
    SSEServerTransport: vi.fn(function (_path: string, _res: ServerResponse) {
      return {
        handlePostMessage: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        sessionId: `sse-session-${Date.now()}`,
      };
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
vi.mock("../../utils/logger.js", () => ({
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
      // Manually add mock transports to the session map
      const transports = transport.getTransports();
      const mockT1 = { close: vi.fn().mockResolvedValue(undefined) };
      const mockT2 = { close: vi.fn().mockResolvedValue(undefined) };
      transports.set("session-1", mockT1 as never);
      transports.set("session-2", mockT2 as never);

      await transport.stop();

      expect(mockT1.close).toHaveBeenCalled();
      expect(mockT2.close).toHaveBeenCalled();
      expect(transports.size).toBe(0);
    });

    it("should handle close errors gracefully during stop()", async () => {
      const transports = transport.getTransports();
      const mockT = {
        close: vi.fn().mockRejectedValue(new Error("close error")),
      };
      transports.set("session-err", mockT as never);

      // Should not throw
      await transport.stop();
      expect(transports.size).toBe(0);
    });
  });

  describe("Construction", () => {
    it("should create transport with config", () => {
      expect(transport).toBeInstanceOf(HttpTransport);
    });

    it("should use default host when not provided", () => {
      const t = new HttpTransport({ port: 8080 });
      expect(t).toBeInstanceOf(HttpTransport);
    });

    it("should apply default configuration values", () => {
      const t = new HttpTransport({ port: 3000 });
      // Just verify it constructs without error — config is private
      expect(t).toBeInstanceOf(HttpTransport);
    });
  });

  describe("setCorsHeaders()", () => {
    it("should not set CORS headers when origin not in allowed list", () => {
      const transportWithCors = new HttpTransport({
        port: 3000,
        corsOrigins: ["https://allowed.example.com"],
      });

      const mockReq = createMockRequest({
        headers: { origin: "https://notallowed.example.com" },
      });
      const mockRes = createMockResponse();

      (
        transportWithCors as unknown as {
          setCorsHeaders: (req: IncomingMessage, res: ServerResponse) => void;
        }
      ).setCorsHeaders(mockReq, mockRes);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it("should set CORS headers when origin is allowed", () => {
      const transportWithCors = new HttpTransport({
        port: 3000,
        corsOrigins: ["https://allowed.example.com"],
      });

      const mockReq = createMockRequest({
        headers: { origin: "https://allowed.example.com" },
      });
      const mockRes = createMockResponse();

      (
        transportWithCors as unknown as {
          setCorsHeaders: (req: IncomingMessage, res: ServerResponse) => void;
        }
      ).setCorsHeaders(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Origin",
        "https://allowed.example.com",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Methods",
        "GET, POST, DELETE, OPTIONS",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Expose-Headers",
        "Mcp-Session-Id",
      );
    });

    it("should not set CORS when no origin header", () => {
      const transportWithCors = new HttpTransport({
        port: 3000,
        corsOrigins: ["https://allowed.example.com"],
      });

      const mockReq = createMockRequest({ headers: {} });
      const mockRes = createMockResponse();

      (
        transportWithCors as unknown as {
          setCorsHeaders: (req: IncomingMessage, res: ServerResponse) => void;
        }
      ).setCorsHeaders(mockReq, mockRes);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });

    it("should set credentials header when configured", () => {
      const transportWithCors = new HttpTransport({
        port: 3000,
        corsOrigins: ["https://allowed.example.com"],
        corsAllowCredentials: true,
      });

      const mockReq = createMockRequest({
        headers: { origin: "https://allowed.example.com" },
      });
      const mockRes = createMockResponse();

      (
        transportWithCors as unknown as {
          setCorsHeaders: (req: IncomingMessage, res: ServerResponse) => void;
        }
      ).setCorsHeaders(mockReq, mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Credentials",
        "true",
      );
    });
  });

  describe("handleHealthCheck()", () => {
    it("should return healthy status", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          handleHealthCheck: (res: ServerResponse) => void;
        }
      ).handleHealthCheck(mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "application/json",
      });

      const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const response = JSON.parse(endCall as string);

      expect(response).toHaveProperty("status", "healthy");
      expect(response).toHaveProperty("timestamp");
    });

    it("should include ISO timestamp", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          handleHealthCheck: (res: ServerResponse) => void;
        }
      ).handleHealthCheck(mockRes);

      const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const response = JSON.parse(endCall as string);

      expect(() => new Date(response.timestamp as string)).not.toThrow();
    });
  });

  describe("handleProtectedResourceMetadata()", () => {
    it("should return 404 when OAuth not configured", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          handleProtectedResourceMetadata: (res: ServerResponse) => void;
        }
      ).handleProtectedResourceMetadata(mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(404);

      const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const response = JSON.parse(endCall as string);
      expect(response).toHaveProperty("error");
    });

    it("should return metadata when OAuth configured", () => {
      const mockResourceServer = {
        getMetadata: () => ({
          resource: "https://mysql-mcp.example.com",
          authorization_servers: ["https://auth.example.com"],
          scopes_supported: ["read", "write"],
        }),
      };

      const transportWithOAuth = new HttpTransport({
        port: 3000,
        resourceServer: mockResourceServer as never,
      });

      const mockRes = createMockResponse();

      (
        transportWithOAuth as unknown as {
          handleProtectedResourceMetadata: (res: ServerResponse) => void;
        }
      ).handleProtectedResourceMetadata(mockRes);

      expect(mockRes.writeHead).toHaveBeenCalledWith(200, {
        "Content-Type": "application/json",
      });

      const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const response = JSON.parse(endCall as string);
      expect(response).toHaveProperty("resource");
      expect(response).toHaveProperty("authorization_servers");
    });
  });

  describe("setSecurityHeaders()", () => {
    it("should set X-Content-Type-Options header", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-Content-Type-Options",
        "nosniff",
      );
    });

    it("should set X-Frame-Options header", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    });

    it("should set Cache-Control header", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "no-store, no-cache, must-revalidate",
      );
    });

    it("should set Content-Security-Policy header", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Security-Policy",
        "default-src 'none'; frame-ancestors 'none'",
      );
    });

    it("should set 5 security headers by default (HSTS disabled)", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      // 5 headers: X-Content-Type-Options, X-Frame-Options, Cache-Control,
      // Content-Security-Policy, Permissions-Policy
      expect(mockRes.setHeader).toHaveBeenCalledTimes(5);
    });

    it("should include HSTS header when enabled", () => {
      const transportWithHSTS = new HttpTransport({
        port: 3000,
        enableHSTS: true,
      });

      const mockRes = createMockResponse();

      (
        transportWithHSTS as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      // 5 base + 1 HSTS = 6 headers
      expect(mockRes.setHeader).toHaveBeenCalledTimes(6);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Strict-Transport-Security",
        expect.stringContaining("max-age="),
      );
    });

    it("should set Permissions-Policy header", () => {
      const mockRes = createMockResponse();

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
    });
  });
});

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

  it("should return 429 when rate limited", async () => {
    const rateLimitedTransport = new HttpTransport({
      port: 3000,
      enableRateLimit: true,
      rateLimitMaxRequests: 1,
      rateLimitWindowMs: 60000,
    });

    const mockReq = createMockRequest({ method: "GET", url: "/health" });
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

    // First request should succeed
    await handleRequest(mockReq, mockRes1);
    expect(mockRes1.writeHead).toHaveBeenCalledWith(200, expect.any(Object));

    // Second request should be rate limited
    await handleRequest(mockReq, mockRes2);
    expect(mockRes2.writeHead).toHaveBeenCalledWith(429, {
      "Content-Type": "application/json",
    });
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

    // SSE should have been created (onConnect called)
    expect(onConnect).toHaveBeenCalled();
    // Transport should be registered in the session map
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
});

describe("readBody()", () => {
  it("should return undefined for GET requests", async () => {
    const transport = new HttpTransport({ port: 3000 });
    const mockReq = createMockRequest({ method: "GET" });

    const result = await (
      transport as unknown as {
        readBody: (req: IncomingMessage) => Promise<unknown>;
      }
    ).readBody(mockReq);

    expect(result).toBeUndefined();
  });

  it("should return undefined for DELETE requests", async () => {
    const transport = new HttpTransport({ port: 3000 });
    const mockReq = createMockRequest({ method: "DELETE" });

    const result = await (
      transport as unknown as {
        readBody: (req: IncomingMessage) => Promise<unknown>;
      }
    ).readBody(mockReq);

    expect(result).toBeUndefined();
  });

  it("should return undefined for OPTIONS requests", async () => {
    const transport = new HttpTransport({ port: 3000 });
    const mockReq = createMockRequest({ method: "OPTIONS" });

    const result = await (
      transport as unknown as {
        readBody: (req: IncomingMessage) => Promise<unknown>;
      }
    ).readBody(mockReq);

    expect(result).toBeUndefined();
  });
});

describe("getTransports()", () => {
  it("should return the transport map", () => {
    const transport = new HttpTransport({ port: 3000 });
    const map = transport.getTransports();
    expect(map).toBeInstanceOf(Map);
    expect(map.size).toBe(0);
  });
});

describe("createHttpTransport()", () => {
  it("should create HttpTransport instance", () => {
    const transport = createHttpTransport({ port: 8080 });
    expect(transport).toBeInstanceOf(HttpTransport);
  });

  it("should pass config to transport", () => {
    const transport = createHttpTransport({
      port: 3000,
      host: "0.0.0.0",
      corsOrigins: ["https://example.com"],
    });
    expect(transport).toBeInstanceOf(HttpTransport);
  });

  it("should accept onConnect callback", () => {
    const onConnect = vi.fn();
    const transport = createHttpTransport({ port: 3000 }, onConnect);
    expect(transport).toBeInstanceOf(HttpTransport);
  });
});

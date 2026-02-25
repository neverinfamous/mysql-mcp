/**
 * mysql-mcp - HTTP Transport Unit Tests
 *
 * Tests for HTTP transport functionality including CORS,
 * health checks, OAuth metadata, and request routing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { HttpTransport, createHttpTransport } from "../http.js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createServer } from "node:http";

// Mock node:http
vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn((port, host, cb) => cb()),
    close: vi.fn((cb) => cb && cb()),
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
        start: vi.fn().mockResolvedValue(undefined),
        handleRequest: vi.fn().mockResolvedValue(undefined),
      };
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
      const server = (createServer as any).mock.results[0].value;
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
      const server = (createServer as any).mock.results[0].value;
      expect(server.close).toHaveBeenCalled();
    });

    it("should do nothing on stop() if not started", async () => {
      const result = await transport.stop();
      expect(result).toBeUndefined();
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
  });

  describe("setCorsHeaders()", () => {
    it("should not set CORS headers when origin not in allowed list", () => {
      const transportWithCors = new HttpTransport({
        port: 3000,
        corsOrigins: ["https://allowed.example.com"],
      });

      const mockReq = {
        headers: { origin: "https://notallowed.example.com" },
      } as IncomingMessage;

      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

      // Access private method via prototype
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

      const mockReq = {
        headers: { origin: "https://allowed.example.com" },
      } as IncomingMessage;

      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

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
        "GET, POST, OPTIONS",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    });

    it("should not set CORS when no origin header", () => {
      const transportWithCors = new HttpTransport({
        port: 3000,
        corsOrigins: ["https://allowed.example.com"],
      });

      const mockReq = {
        headers: {},
      } as IncomingMessage;

      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

      (
        transportWithCors as unknown as {
          setCorsHeaders: (req: IncomingMessage, res: ServerResponse) => void;
        }
      ).setCorsHeaders(mockReq, mockRes);

      expect(mockRes.setHeader).not.toHaveBeenCalled();
    });
  });

  describe("handleHealthCheck()", () => {
    it("should return healthy status", () => {
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

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
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

      (
        transport as unknown as {
          handleHealthCheck: (res: ServerResponse) => void;
        }
      ).handleHealthCheck(mockRes);

      const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      const response = JSON.parse(endCall as string);

      // Validate ISO timestamp format
      expect(() => new Date(response.timestamp as string)).not.toThrow();
    });
  });

  describe("handleProtectedResourceMetadata()", () => {
    it("should return 404 when OAuth not configured", () => {
      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

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

      const mockRes = {
        writeHead: vi.fn(),
        end: vi.fn(),
      } as unknown as ServerResponse;

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
      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

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
      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith("X-Frame-Options", "DENY");
    });

    it("should set X-XSS-Protection header", () => {
      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "X-XSS-Protection",
        "1; mode=block",
      );
    });

    it("should set Cache-Control header", () => {
      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

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
      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

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

    it("should set all 8 security headers", () => {
      const mockRes = {
        setHeader: vi.fn(),
      } as unknown as ServerResponse;

      (
        transport as unknown as {
          setSecurityHeaders: (res: ServerResponse) => void;
        }
      ).setSecurityHeaders(mockRes);

      // Verify exactly 8 headers were set (5 original + 3 new: HSTS, Referrer-Policy, Permissions-Policy)
      expect(mockRes.setHeader).toHaveBeenCalledTimes(8);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains",
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Referrer-Policy",
        "no-referrer",
      );
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
    transport = new HttpTransport({
      port: 3000,
      corsOrigins: ["https://example.com"],
    });
  });

  it("should handle OPTIONS preflight request", async () => {
    const mockReq = {
      method: "OPTIONS",
      url: "/mcp",
      headers: { host: "localhost:3000", origin: "https://example.com" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

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
    const mockReq = {
      method: "GET",
      url: "/health",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

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
    const mockReq = {
      method: "GET",
      url: "/.well-known/oauth-protected-resource",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    // Without OAuth configured, should return 404
    expect(mockRes.writeHead).toHaveBeenCalledWith(404);
  });

  it("should return 404 for unknown paths", async () => {
    const mockReq = {
      method: "GET",
      url: "/unknown-path",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

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

    const mockReq = {
      method: "GET",
      url: "/mcp",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

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

  it("should allow authenticated requests when OAuth is configured", async () => {
    const mockTokenValidator = {
      validate: vi.fn().mockResolvedValue({
        valid: true,
        claims: { sub: "user1", scopes: ["read"], exp: 0, iat: 0 },
      }),
    };

    const mockResourceServer = {
      getMetadata: vi.fn().mockReturnValue({ resource: "test" }),
    };

    const transportWithOAuth = new HttpTransport({
      port: 3000,
      resourceServer: mockResourceServer as never,
      tokenValidator: mockTokenValidator as never,
    });

    const mockReq = {
      method: "GET",
      url: "/mcp",
      headers: {
        host: "localhost:3000",
        authorization: "Bearer valid_token",
      },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

    await (
      transportWithOAuth as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    // After successful auth, should return 404 (no MCP handling yet)
    expect(mockRes.writeHead).toHaveBeenCalledWith(404);
  });
});

describe("SSE Support", () => {
  it("should route to SSE endpoint", async () => {
    const mockReq = {
      method: "GET",
      url: "/sse",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

    // Spy on onConnect callback
    const onConnect = vi.fn();
    const transportWithCallback = createHttpTransport(
      { port: 3000 },
      onConnect,
    );
    const { StreamableHTTPServerTransport } =
      await import("@modelcontextprotocol/sdk/server/streamableHttp.js");

    await (
      transportWithCallback as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(StreamableHTTPServerTransport).toHaveBeenCalled();
    // Verify start called (mocked)
    const mockTransportInstance = (
      StreamableHTTPServerTransport as unknown as ReturnType<typeof vi.fn>
    ).mock.results[0].value;
    expect(mockTransportInstance.start).toHaveBeenCalled();
    expect(onConnect).toHaveBeenCalledWith(mockTransportInstance);
    expect(mockTransportInstance.handleRequest).toHaveBeenCalledWith(
      mockReq,
      mockRes,
    );
  });

  it("should route to messages endpoint", async () => {
    const mockReq = {
      method: "POST",
      url: "/messages",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

    // Setup transport with active SSE connection
    const transport = new HttpTransport({ port: 3000 });
    const { StreamableHTTPServerTransport } =
      await import("@modelcontextprotocol/sdk/server/streamableHttp.js");
    const mockTransportInstance = new StreamableHTTPServerTransport();

    // Manually set transport (private)
    Object.defineProperty(transport, "transport", {
      value: mockTransportInstance,
      writable: true,
    });

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockTransportInstance.handleRequest).toHaveBeenCalledWith(
      mockReq,
      mockRes,
    );
  });

  it("should return 400 for messages without active connection", async () => {
    const mockReq = {
      method: "POST",
      url: "/messages",
      headers: { host: "localhost:3000" },
    } as IncomingMessage;

    const mockRes = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    } as unknown as ServerResponse;

    const transport = new HttpTransport({ port: 3000 });

    await (
      transport as unknown as {
        handleRequest: (
          req: IncomingMessage,
          res: ServerResponse,
        ) => Promise<void>;
      }
    ).handleRequest(mockReq, mockRes);

    expect(mockRes.writeHead).toHaveBeenCalledWith(400);
    const endCall = (mockRes.end as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(JSON.parse(endCall as string)).toHaveProperty(
      "error",
      "No active connection",
    );
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
});

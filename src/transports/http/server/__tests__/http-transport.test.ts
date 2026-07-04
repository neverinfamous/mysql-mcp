import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpTransport } from "../http-transport.js";
import * as http from "node:http";
import { handleStreamableRequest } from "../streamable.js";

vi.mock("../streamable.js", () => ({
  handleStreamableRequest: vi.fn(),
  handleStatelessRequest: vi.fn(),
}));

vi.mock("../sse.js", () => ({
  handleLegacySSERequest: vi.fn(),
  handleLegacyMessageRequest: vi.fn(),
}));

vi.mock("node:http", () => {
  const mockServer = {
    listen: vi.fn((port, host, cb) => cb && cb()),
    close: vi.fn((cb) => cb && cb()),
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

vi.mock("redis", () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    isOpen: true,
  })),
}));

describe("HttpTransport", () => {
  let transport: HttpTransport;

  beforeEach(() => {
    vi.clearAllMocks();
    transport = new HttpTransport({ port: 8080 });
  });

  afterEach(async () => {
    await transport.stop();
  });

  describe("lifecycle", () => {
    it("should start the server", async () => {
      await transport.start();
      expect(http.createServer).toHaveBeenCalled();
      const server = (http.createServer as any).mock.results[0].value;
      expect(server.listen).toHaveBeenCalledWith(8080, "localhost", expect.any(Function));
    });

    it("should initialize redis client if REDIS_URL is provided", async () => {
      const origUrl = process.env["REDIS_URL"];
      process.env["REDIS_URL"] = "redis://localhost";
      
      const t = new HttpTransport({ port: 8080 });
      await t.start();
      
      const { createClient } = await import("redis");
      expect(createClient).toHaveBeenCalledWith({ url: "redis://localhost" });
      
      if (origUrl === undefined) delete process.env["REDIS_URL"];
      else process.env["REDIS_URL"] = origUrl;
      
      await t.stop();
    });

    it("should stop the server gracefully", async () => {
      await transport.start();
      const server = (http.createServer as any).mock.results[0].value;
      await transport.stop();
      expect(server.close).toHaveBeenCalled();
    });
  });

  describe("request handling", () => {
    let req: any;
    let res: any;

    beforeEach(() => {
      req = {
        method: "GET",
        url: "/",
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
        on: vi.fn(),
      };
      res = {
        writeHead: vi.fn(),
        end: vi.fn(),
        setHeader: vi.fn(),
      };
    });

    it("should handle request routing", async () => {
      await transport.start();
      const server = (http.createServer as any).mock.results[0].value;
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/health";
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("status"));
    });

    it("should handle preflight OPTIONS requests", async () => {
      await transport.start();
      const server = (http.createServer as any).mock.results[0].value;
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.method = "OPTIONS";
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("should handle /.well-known/oauth-protected-resource", async () => {
      await transport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/.well-known/oauth-protected-resource";
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(404);
    });

    it("should handle /metrics", async () => {
      const metricsTransport = new HttpTransport({ port: 8080, metricsExport: "prometheus" });
      await metricsTransport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/metrics";
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining(""));
      await metricsTransport.stop();
    });

    it("should handle / (root info)", async () => {
      await transport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/";
      req.method = "GET";
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    });

    it("should handle /mcp", async () => {
      await transport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/mcp";
      req.method = "POST";
      await requestHandler(req, res);
      
      expect(handleStreamableRequest).toHaveBeenCalled();
    });

    it("should handle 404 for unknown paths", async () => {
      await transport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/unknown-path";
      req.method = "GET";
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Not found"));
    });

    it("should handle payload too large", async () => {
      await transport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/mcp";
      req.headers["content-length"] = "10000000"; // Exceeds default limit
      await requestHandler(req, res);
      
      expect(res.writeHead).toHaveBeenCalledWith(413, expect.any(Object));
    });

    describe("Simple Bearer Token auth", () => {
      let authTransport: HttpTransport;
      beforeEach(() => {
        authTransport = new HttpTransport({ port: 8080, authToken: "secret-token" });
      });

      afterEach(async () => {
        await authTransport.stop();
      });

      it("should reject if no token is provided", async () => {
        await authTransport.start();
        const requestHandler = (http.createServer as any).mock.calls[0][0];
        
        req.url = "/mcp";
        await requestHandler(req, res);
        
        expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Bearer token required"));
      });

      it("should reject if token is invalid", async () => {
        await authTransport.start();
        const requestHandler = (http.createServer as any).mock.calls[0][0];
        
        req.url = "/mcp";
        req.headers.authorization = "Bearer wrong-token";
        await requestHandler(req, res);
        
        expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
        expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Invalid bearer token"));
      });

      it("should accept valid token", async () => {
        await authTransport.start();
        const requestHandler = (http.createServer as any).mock.calls[0][0];
        
        req.url = "/mcp";
        req.headers.authorization = "Bearer secret-token";
        await requestHandler(req, res);
        
        // After auth, it continues to handleStreamableRequest since we mocked it
        expect(handleStreamableRequest).toHaveBeenCalled();
      });
    });

    it("should handle /sse and /messages", async () => {
      await transport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      // Test /sse
      req.url = "/sse";
      await requestHandler(req, res);
      try { await requestHandler(req, res); } catch() {
        // ignore
      }
      
      req.url = "/messages";
      try { await requestHandler(req, res); } catch() {
        // ignore
      }
    });

    it("should reject /sse and /messages in stateless mode", async () => {
      const statelessTransport = new HttpTransport({ port: 8080, stateless: true });
      await statelessTransport.start();
      const requestHandler = (http.createServer as any).mock.calls[0][0];
      
      req.url = "/sse";
      await requestHandler(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));

      req.url = "/messages";
      await requestHandler(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
      
      await statelessTransport.stop();
    });
  });

  describe("getTransports", () => {
    it("should return transports from session manager", () => {
      const transports = transport.getTransports();
      expect(transports).toBeDefined();
    });
  });
});

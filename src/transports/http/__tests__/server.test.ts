import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { HttpTransport } from "../server/index.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";

// Suppress logger
vi.mock("../../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../security.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../security.js")>();
  return {
    ...actual,
    readBody: vi.fn().mockResolvedValue({}),
  };
});

function createMockReqRes(
  method: string,
  url: string,
  headers: Record<string, string> = {},
) {
  const req = new IncomingMessage(new Socket());
  req.method = method;
  req.url = url;
  req.headers = { host: "localhost", ...headers };

  // mock for stream logic if needed
  req.on = vi.fn((event, callback) => {
    if (event === "end") callback();
    return req;
  }) as any;

  const res = new ServerResponse(req);
  res.writeHead = vi.fn().mockReturnThis();
  res.end = vi.fn();

  return { req, res };
}

describe("HttpTransport", () => {
  let transport: HttpTransport;

  beforeEach(() => {
    transport = new HttpTransport({ port: 0 });
  });

  afterEach(async () => {
    await transport.stop();
  });

  describe("Lifecycle", () => {
    it("should start and stop successfully", async () => {
      // Mocking listen since port 0 might still try to bind
      await transport.start();
      expect(transport).toBeDefined();
    });
  });

  describe("Request Handling", () => {
    it("should return 404 for unknown paths", async () => {
      const { req, res } = createMockReqRes("GET", "/unknown");
      await (transport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(404);
      expect(res.end).toHaveBeenCalled();
    });

    it("should handle preflight OPTIONS request", async () => {
      const { req, res } = createMockReqRes("OPTIONS", "/mcp");
      await (transport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(204);
    });

    it("should require auth token if configured", async () => {
      const authTransport = new HttpTransport({
        port: 0,
        authToken: "secret123",
      });
      const { req, res } = createMockReqRes("POST", "/mcp");
      await (authTransport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));

      const { req: reqWithAuth, res: resWithAuth } = createMockReqRes(
        "POST",
        "/mcp",
        { authorization: "Bearer secret123" },
      );
      await (authTransport as any).handleRequest(reqWithAuth, resWithAuth);
      expect(resWithAuth.writeHead).not.toHaveBeenCalledWith(
        401,
        expect.any(Object),
      );
      const { req: reqInvalid, res: resInvalid } = createMockReqRes(
        "POST",
        "/mcp",
        { authorization: "Bearer invalid" },
      );
      await (authTransport as any).handleRequest(reqInvalid, resInvalid);
      expect(resInvalid.writeHead).toHaveBeenCalledWith(
        401,
        expect.any(Object),
      );
    });

    it("should enforce max body size", async () => {
      const smallTransport = new HttpTransport({ port: 0, maxBodySize: 10 });
      const { req, res } = createMockReqRes("POST", "/mcp", {
        "content-length": "100",
      });
      await (smallTransport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(413, expect.any(Object));
    });

    it("should handle stateless /mcp request with wrong method", async () => {
      const statelessTransport = new HttpTransport({
        port: 0,
        stateless: true,
      });
      const { req, res } = createMockReqRes("GET", "/mcp");
      await (statelessTransport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));

      const { req: reqDel, res: resDel } = createMockReqRes("DELETE", "/mcp");
      await (statelessTransport as any).handleRequest(reqDel, resDel);
      expect(resDel.writeHead).toHaveBeenCalledWith(204);
    });

    it("should return 400 for /mcp POST without session and not initialize", async () => {
      const { req, res } = createMockReqRes("POST", "/mcp");
      // mock readBody returning something other than initialize
      // we can simulate readBody error by passing unreadable req
      await (transport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
    });

    it("should reject legacy SSE in stateless mode", async () => {
      const statelessTransport = new HttpTransport({
        port: 0,
        stateless: true,
      });
      const { req, res } = createMockReqRes("GET", "/sse");
      await (statelessTransport as any).handleRequest(req, res);
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));

      const { req: reqMsg, res: resMsg } = createMockReqRes(
        "POST",
        "/messages?sessionId=123",
      );
      await (statelessTransport as any).handleRequest(reqMsg, resMsg);
      expect(resMsg.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });
});

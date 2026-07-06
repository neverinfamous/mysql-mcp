import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleStreamableRequest, handleStatelessRequest } from "../streamable.js";
import { IncomingMessage, ServerResponse } from "node:http";
import { SessionManager } from "../../session-manager.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { SESSION_ABSOLUTE_TTL_MS } from "../../types.js";
import * as security from "../../security.js";
import * as utils from "../utils.js";

vi.mock("../../security.js", () => ({
  readBody: vi.fn(),
}));

vi.mock("../utils.js", () => ({
  checkToolScope: vi.fn(),
}));

describe("streamable", () => {
  let req: Partial<IncomingMessage>;
  let res: Partial<ServerResponse>;
  let sessionManager: SessionManager;

  beforeEach(() => {
    req = {
      method: "POST",
      headers: {},
    };
    res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn(),
    };
    sessionManager = new SessionManager();
    vi.clearAllMocks();
  });

  describe("handleStreamableRequest", () => {
    it("should handle DELETE by closing the session", async () => {
      req.method = "DELETE";
      req.headers = { "mcp-session-id": "test-session" };
      
      const closeSpy = vi.spyOn(sessionManager, "close").mockResolvedValue(undefined);
      sessionManager.get = vi.fn().mockReturnValue({ transport: {} });
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(closeSpy).toHaveBeenCalledWith("test-session");
      expect(res.writeHead).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("should return 400 for DELETE without session ID", async () => {
      req.method = "DELETE";
      req.headers = {};
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("No valid session ID"));
    });

    it("should return 400 for POST without session ID that is not an initialize request", async () => {
      req.method = "POST";
      req.headers = {};
      
      vi.mocked(security.readBody).mockResolvedValueOnce({ method: "ping" }); // Not initialize
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("No valid session ID"));
    });

    it("should create a new session for initialize request without session ID", async () => {
      req.method = "POST";
      req.headers = {};
      
      vi.mocked(security.readBody).mockResolvedValueOnce({ 
        jsonrpc: "2.0", 
        method: "initialize", 
        params: { 
          protocolVersion: "2024-11-05", 
          capabilities: {}, 
          clientInfo: { name: "test", version: "1.0.0" } 
        } 
      });
      const onConnect = vi.fn().mockResolvedValue(undefined);
      
      // Spy on StreamableHTTPServerTransport.handleRequest
      const handleRequestSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager, undefined, onConnect);
      
      expect(onConnect).toHaveBeenCalled();
      expect(res.setHeader).toHaveBeenCalledWith("Mcp-Session-Id", expect.any(String));
      expect(handleRequestSpy).toHaveBeenCalled();
      
      // Get the created transport to test onclose
      const transportCall = onConnect.mock.calls[0][0] as StreamableHTTPServerTransport;
      
      // Test onclose with valid session
      const getSpy = vi.spyOn(sessionManager, "get").mockReturnValue({} as any);
      const closeSpy = vi.spyOn(sessionManager, "close").mockResolvedValue(undefined);
      
      if (transportCall.onclose) {
        transportCall.onclose();
      }
      expect(getSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      
      handleRequestSpy.mockRestore();
    });

    it("should reject sessions using different transport", async () => {
      req.method = "POST";
      req.headers = { "mcp-session-id": "test-session" };
      
      vi.mocked(security.readBody).mockResolvedValueOnce({ method: "ping" });
      
      const wrongTransport = new SSEServerTransport("/message", {} as any);
      sessionManager.get = vi.fn().mockReturnValue({ 
        transport: wrongTransport,
        createdAt: Date.now()
      });
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("different transport protocol"));
    });

    it("should reject non-POST requests with different transport", async () => {
      req.method = "GET";
      req.headers = { "mcp-session-id": "test-session" };
      
      const wrongTransport = new SSEServerTransport("/message", {} as any);
      sessionManager.get = vi.fn().mockReturnValue({ 
        transport: wrongTransport,
        createdAt: Date.now()
      });
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("different transport protocol"));
    });

    it("should reject expired sessions", async () => {
      req.method = "POST";
      req.headers = { "mcp-session-id": "test-session" };
      
      vi.mocked(security.readBody).mockResolvedValueOnce({ method: "ping" });
      
      const transport = new StreamableHTTPServerTransport({});
      sessionManager.get = vi.fn().mockReturnValue({ 
        transport,
        createdAt: Date.now() - SESSION_ABSOLUTE_TTL_MS - 1000 // Expired
      });
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("TTL expired"));
    });

    it("should reject expired sessions on GET stream connect", async () => {
      req.method = "GET";
      req.headers = { "mcp-session-id": "test-session" };
      
      const transport = new StreamableHTTPServerTransport({});
      sessionManager.get = vi.fn().mockReturnValue({ 
        transport,
        createdAt: Date.now() - SESSION_ABSOLUTE_TTL_MS - 1000 // Expired
      });
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("TTL expired"));
    });

    it("should process valid GET request with existing session", async () => {
      req.method = "GET";
      req.headers = { "mcp-session-id": "test-session" };
      
      const transport = new StreamableHTTPServerTransport({});
      const handleRequestSpy = vi.spyOn(transport, "handleRequest").mockResolvedValue(undefined);
      
      sessionManager.get = vi.fn().mockReturnValue({ 
        transport,
        createdAt: Date.now()
      });
      
      const touchSpy = vi.spyOn(sessionManager, "touch");
      const incSpy = vi.spyOn(sessionManager, "incrementInFlight");
      const decSpy = vi.spyOn(sessionManager, "decrementInFlight");
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(handleRequestSpy).toHaveBeenCalledWith(req, res);
      expect(touchSpy).toHaveBeenCalledWith("test-session");
      expect(incSpy).toHaveBeenCalledWith("test-session");
      expect(decSpy).toHaveBeenCalledWith("test-session");
    });


    it("should process valid POST request with existing session", async () => {
      req.method = "POST";
      req.headers = { "mcp-session-id": "test-session" };
      
      const body = { method: "ping" };
      vi.mocked(security.readBody).mockResolvedValueOnce(body);
      
      const transport = new StreamableHTTPServerTransport({});
      const handleRequestSpy = vi.spyOn(transport, "handleRequest").mockResolvedValue(undefined);
      
      sessionManager.get = vi.fn().mockReturnValue({ 
        transport,
        createdAt: Date.now()
      });
      const touchSpy = vi.spyOn(sessionManager, "touch");
      const incSpy = vi.spyOn(sessionManager, "incrementInFlight");
      const decSpy = vi.spyOn(sessionManager, "decrementInFlight");
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(handleRequestSpy).toHaveBeenCalledWith(req, res, body);
      expect(touchSpy).toHaveBeenCalledWith("test-session");
      expect(incSpy).toHaveBeenCalledWith("test-session");
      expect(decSpy).toHaveBeenCalledWith("test-session");
    });
    
    it("should reject requests if readBody throws", async () => {
      req.method = "POST";
      vi.mocked(security.readBody).mockRejectedValueOnce(new Error("Parse Error"));
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Invalid JSON"));
    });

    it("should validate tool scope if authContext is provided", async () => {
      req.method = "POST";
      const body = { method: "ping" };
      vi.mocked(security.readBody).mockResolvedValueOnce(body);
      vi.mocked(utils.checkToolScope).mockReturnValueOnce(false);
      
      const authContext = { token: "test", user: "test", scopes: [] };
      const getSpy = vi.spyOn(sessionManager, "get");
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager, authContext);
      
      expect(utils.checkToolScope).toHaveBeenCalledWith(body, authContext, res);
      // It should return early because checkToolScope returned false
      expect(getSpy).not.toHaveBeenCalled();
    });

    it("should reject POST with invalid session id (not found)", async () => {
      req.method = "POST";
      req.headers = { "mcp-session-id": "test-session" };
      
      vi.mocked(security.readBody).mockResolvedValueOnce({ method: "ping" });
      sessionManager.get = vi.fn().mockReturnValue(undefined);
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Session not found"));
    });

    it("should reject non-POST request with invalid session id (not found)", async () => {
      req.method = "GET";
      req.headers = { "mcp-session-id": "test-session" };
      
      sessionManager.get = vi.fn().mockReturnValue(undefined);
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Session not found"));
    });

    it("should reject non-POST request when no session id is provided", async () => {
      req.method = "GET";
      req.headers = {};
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("No valid session ID provided"));
    });

    it("should return early when initialized request does not have session id", async () => {
      req.method = "POST";
      req.headers = {};
      
      vi.mocked(security.readBody).mockResolvedValueOnce({ 
        jsonrpc: "2.0", 
        method: "initialize",
        params: { 
          protocolVersion: "2024-11-05", 
          capabilities: {}, 
          clientInfo: { name: "test", version: "1.0.0" } 
        } 
      });
      const onConnect = vi.fn().mockResolvedValue(undefined);
      
      const handleRequestSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
      
      await handleStreamableRequest(req as IncomingMessage, res as ServerResponse, sessionManager, undefined, onConnect);
      
      expect(res.setHeader).toHaveBeenCalledWith("Mcp-Session-Id", expect.any(String));
      expect(handleRequestSpy).toHaveBeenCalled();
      
      // Simulate close event where sessionId is null on transport (fallback to generated ID)
      const transportCall = onConnect.mock.calls[0][0] as StreamableHTTPServerTransport;
      Object.defineProperty(transportCall, 'sessionId', { get: () => undefined });
      
      const getSpy = vi.spyOn(sessionManager, "get").mockReturnValue({} as any);
      const closeSpy = vi.spyOn(sessionManager, "close").mockResolvedValue(undefined);
      
      if (transportCall.onclose) {
        transportCall.onclose();
      }
      expect(getSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      
      handleRequestSpy.mockRestore();
    });
  });

  describe("handleStatelessRequest", () => {
    it("should reject GET requests", async () => {
      req.method = "GET";
      
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse);
      
      expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("not available in stateless mode"));
    });

    it("should handle DELETE requests with 204", async () => {
      req.method = "DELETE";
      
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse);
      
      expect(res.writeHead).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalled();
    });

    it("should reject non-POST requests", async () => {
      req.method = "PUT";
      
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse);
      
      expect(res.writeHead).toHaveBeenCalledWith(405, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Method not allowed"));
    });
    
    it("should handle body parsing errors", async () => {
      req.method = "POST";
      vi.mocked(security.readBody).mockRejectedValueOnce(new Error("Parse Error"));
      
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse);
      
      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object));
      expect(res.end).toHaveBeenCalledWith(expect.stringContaining("Invalid JSON"));
    });

    it("should process stateless POST request and call onConnect", async () => {
      req.method = "POST";
      const body = { method: "ping" };
      vi.mocked(security.readBody).mockResolvedValueOnce(body);
      vi.mocked(utils.checkToolScope).mockReturnValueOnce(true); // Should pass auth
      
      const onConnect = vi.fn().mockResolvedValue(undefined);
      const handleRequestSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
      const closeSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
      
      const authContext = { token: "test", user: "test", scopes: [] };
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse, authContext, onConnect);
      
      expect(utils.checkToolScope).toHaveBeenCalledWith(body, authContext, res);
      expect(onConnect).toHaveBeenCalled();
      expect(handleRequestSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      
      handleRequestSpy.mockRestore();
      closeSpy.mockRestore();
    });

    it("should handle transport closure errors silently", async () => {
      req.method = "POST";
      const body = { method: "ping" };
      vi.mocked(security.readBody).mockResolvedValueOnce(body);
      
      const handleRequestSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(new Error("Transport error"));
      const closeSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "close").mockResolvedValue(undefined);
      
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse);
      
      expect(handleRequestSpy).toHaveBeenCalled();
      expect(closeSpy).toHaveBeenCalled();
      
      handleRequestSpy.mockRestore();
      closeSpy.mockRestore();
    });

    it("should reject if checkToolScope fails", async () => {
      req.method = "POST";
      const body = { method: "ping" };
      vi.mocked(security.readBody).mockResolvedValueOnce(body);
      vi.mocked(utils.checkToolScope).mockReturnValueOnce(false); // Fails
      
      const authContext = { token: "test", user: "test", scopes: [] };
      const handleRequestSpy = vi.spyOn(StreamableHTTPServerTransport.prototype, "handleRequest").mockResolvedValue(undefined);
      
      await handleStatelessRequest(req as IncomingMessage, res as ServerResponse, authContext);
      
      expect(utils.checkToolScope).toHaveBeenCalledWith(body, authContext, res);
      expect(handleRequestSpy).not.toHaveBeenCalled();
      
      handleRequestSpy.mockRestore();
    });
  });
});

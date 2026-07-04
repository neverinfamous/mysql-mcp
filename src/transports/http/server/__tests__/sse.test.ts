import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleLegacySSERequest, handleLegacyMessageRequest } from "../sse.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { readBody } from "../../security.js";
import { SESSION_ABSOLUTE_TTL_MS } from "../../types.js";
import { checkToolScope } from "../utils.js";

export const mockConstructorSpy = vi.fn();

vi.mock("@modelcontextprotocol/sdk/server/sse.js", () => {
  return {
    SSEServerTransport: class {
      sessionId = "test-session-123";
      handlePostMessage = vi.fn();
      constructor(...args: any[]) {
        mockConstructorSpy(...args);
      }
    }
  };
});

vi.mock("../../security.js", () => ({
  readBody: vi.fn(),
}));

vi.mock("../utils.js", () => ({
  checkToolScope: vi.fn().mockReturnValue(true),
}));

vi.mock("../../../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
  },
}));

describe("sse", () => {
  let mockReq: any;
  let mockRes: any;
  let mockSessionManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockReq = {
      on: vi.fn(),
    };
    
    mockRes = {
      on: vi.fn(),
      writeHead: vi.fn(),
      end: vi.fn(),
    };
    
    mockSessionManager = {
      register: vi.fn(),
      close: vi.fn(),
      get: vi.fn(),
      touch: vi.fn(),
      incrementInFlight: vi.fn(),
      decrementInFlight: vi.fn(),
    };
  });

  describe("handleLegacySSERequest", () => {
    it("should initialize SSE transport and register session", async () => {
      const onConnect = vi.fn().mockResolvedValue(undefined);
      
      await handleLegacySSERequest(mockReq, mockRes, mockSessionManager, onConnect);
      
      expect(mockConstructorSpy).toHaveBeenCalledWith("/messages", mockRes);
      expect(mockSessionManager.register).toHaveBeenCalledWith("test-session-123", expect.any(Object));
      expect(mockRes.on).toHaveBeenCalledWith("close", expect.any(Function));
      expect(onConnect).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should handle response close event", async () => {
      await handleLegacySSERequest(mockReq, mockRes, mockSessionManager);
      
      // Extract the close handler
      const closeHandler = mockRes.on.mock.calls.find((call: any) => call[0] === "close")[1];
      
      // Trigger it
      closeHandler();
      
      expect(mockSessionManager.close).toHaveBeenCalledWith("test-session-123");
    });
  });

  describe("handleLegacyMessageRequest", () => {
    it("should reject if sessionId is missing", async () => {
      const url = new URL("http://localhost/messages");
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining("Missing sessionId"));
    });

    it("should reject if session not found", async () => {
      const url = new URL("http://localhost/messages?sessionId=invalid");
      mockSessionManager.get.mockReturnValue(undefined);
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(404, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining("No transport found"));
    });

    it("should reject if transport is not SSEServerTransport", async () => {
      const url = new URL("http://localhost/messages?sessionId=valid");
      // Give it a regular object, not an instance of SSEServerTransport
      mockSessionManager.get.mockReturnValue({ transport: {} });
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining("different transport protocol"));
    });

    it("should reject if absolute TTL is exceeded", async () => {
      const url = new URL("http://localhost/messages?sessionId=valid");
       
      const fakeTransport = new SSEServerTransport("/messages", mockRes);
      
      mockSessionManager.get.mockReturnValue({ 
        transport: fakeTransport,
        createdAt: Date.now() - SESSION_ABSOLUTE_TTL_MS - 1000 // 1 second past TTL
      });
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(401, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining("absolute TTL expired"));
    });

    it("should reject on JSON parse error", async () => {
      const url = new URL("http://localhost/messages?sessionId=valid");
       
      const fakeTransport = new SSEServerTransport("/messages", mockRes);
      
      mockSessionManager.get.mockReturnValue({ 
        transport: fakeTransport,
        createdAt: Date.now()
      });
      
      vi.mocked(readBody).mockRejectedValue(new Error("Invalid JSON"));
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager);
      
      expect(mockRes.writeHead).toHaveBeenCalledWith(400, { "Content-Type": "application/json" });
      expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining("Parse error"));
    });

    it("should stop if tool scope check fails", async () => {
      const url = new URL("http://localhost/messages?sessionId=valid");
       
      const fakeTransport = new SSEServerTransport("/messages", mockRes);
      
      mockSessionManager.get.mockReturnValue({ 
        transport: fakeTransport,
        createdAt: Date.now()
      });
      
      const body = { jsonrpc: "2.0", method: "tools/call" };
      vi.mocked(readBody).mockResolvedValue(body);
      
      // Simulate scope check failure (it handles response internally)
      vi.mocked(checkToolScope).mockReturnValue(false);
      
      const authContext = { token: "token", scopes: [] };
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager, authContext);
      
      expect(checkToolScope).toHaveBeenCalledWith(body, authContext, mockRes);
      expect(fakeTransport.handlePostMessage).not.toHaveBeenCalled();
    });

    it("should process message and update session metrics", async () => {
      const url = new URL("http://localhost/messages?sessionId=valid");
       
      const fakeTransport = new SSEServerTransport("/messages", mockRes);
      
      mockSessionManager.get.mockReturnValue({ 
        transport: fakeTransport,
        createdAt: Date.now()
      });
      
      const body = { jsonrpc: "2.0", method: "ping" };
      vi.mocked(readBody).mockResolvedValue(body);
      
      await handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager);
      
      expect(mockSessionManager.touch).toHaveBeenCalledWith("valid");
      expect(mockSessionManager.incrementInFlight).toHaveBeenCalledWith("valid");
      expect(fakeTransport.handlePostMessage).toHaveBeenCalledWith(mockReq, mockRes, body);
      expect(mockSessionManager.decrementInFlight).toHaveBeenCalledWith("valid");
      // Called twice (before and after)
      expect(mockSessionManager.touch).toHaveBeenCalledTimes(2);
    });

    it("should decrement in-flight even if handlePostMessage throws", async () => {
      const url = new URL("http://localhost/messages?sessionId=valid");
       
      const fakeTransport = new SSEServerTransport("/messages", mockRes);
      fakeTransport.handlePostMessage = vi.fn().mockRejectedValue(new Error("Handler error"));
      
      mockSessionManager.get.mockReturnValue({ 
        transport: fakeTransport,
        createdAt: Date.now()
      });
      
      const body = { jsonrpc: "2.0", method: "ping" };
      vi.mocked(readBody).mockResolvedValue(body);
      
      await expect(handleLegacyMessageRequest(mockReq, mockRes, url, mockSessionManager))
        .rejects.toThrow("Handler error");
      
      expect(mockSessionManager.incrementInFlight).toHaveBeenCalledWith("valid");
      expect(mockSessionManager.decrementInFlight).toHaveBeenCalledWith("valid");
    });
  });
});

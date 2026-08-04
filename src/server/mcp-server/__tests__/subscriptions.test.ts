import { describe, it, expect, vi, beforeEach } from "vitest";
import { setupSubscriptions } from "../subscriptions.js";

import { McpServer, ProtocolError } from "@modelcontextprotocol/server";
import { SubscriptionManager } from "../../subscription-manager.js";

describe("setupSubscriptions", () => {
  let mcpServer: McpServer;
  let subscriptionManager: SubscriptionManager;

  beforeEach(() => {
    mcpServer = new McpServer({ name: "test", version: "1.0.0" });
    subscriptionManager = new SubscriptionManager(mcpServer.server);
    
    vi.spyOn(mcpServer.server, "setRequestHandler");
    vi.spyOn(subscriptionManager, "subscribe").mockImplementation(() => {});
    vi.spyOn(subscriptionManager, "unsubscribe").mockImplementation(() => {});
  });

  it("should register Subscribe and Unsubscribe handlers", () => {
    setupSubscriptions(mcpServer, subscriptionManager);

    expect(mcpServer.server.setRequestHandler).toHaveBeenCalledWith(
      "resources/subscribe",
      expect.any(Function)
    );
    
    expect(mcpServer.server.setRequestHandler).toHaveBeenCalledWith(
      "resources/unsubscribe",
      expect.any(Function)
    );
  });

  describe("SubscribeHandler", () => {
    let subscribeHandler: (req: unknown, extra: unknown) => unknown;

    beforeEach(() => {
      setupSubscriptions(mcpServer, subscriptionManager);
      const subscribeCall = (mcpServer.server.setRequestHandler as Record<string, unknown>).mock.calls.find(
        (call: unknown[]) => call[0] === "resources/subscribe"
      );
      subscribeHandler = subscribeCall[1];
    });

    it("should allow subscription to valid resources", () => {
      const validUris = [
        "mysql://schema",
        "mysql://tables",
        "mysql://health",
        "mysql://table/users",
        "mysql://table/orders"
      ];

      for (const uri of validUris) {
        const request = { params: { uri } };
        const extra = { sessionId: "sess-123" };
        
        const result = subscribeHandler(request, extra);
        expect(result).toEqual({});
        expect(subscriptionManager.subscribe).toHaveBeenCalledWith(uri, "sess-123");
      }
    });

    it("should reject subscription to invalid resources", () => {
      const invalidUris = [
        "mysql://invalid",
        "mysql://table", // No table name
        "http://example.com"
      ];

      for (const uri of invalidUris) {
        const request = { params: { uri } };
        const extra = { sessionId: "sess-123" };
        
        expect(() => subscribeHandler(request, extra)).toThrow(ProtocolError);
        expect(() => subscribeHandler(request, extra)).toThrowError(
          `Resource ${uri} is not subscribable`
        );
        expect(subscriptionManager.subscribe).not.toHaveBeenCalledWith(uri, expect.anything());
      }
    });

    it("should fallback to header session ID if extra.sessionId is missing", () => {
      const request = { params: { uri: "mysql://schema" } };
      const extra = { http: { req: { headers: { get: (name: string) => name === "mcp-session-id" ? "sess-header" : null } } } };
      
      subscribeHandler(request, extra);
      expect(subscriptionManager.subscribe).toHaveBeenCalledWith("mysql://schema", "sess-header");
    });

    it("should fallback to 'default' session ID if none provided", () => {
      const request = { params: { uri: "mysql://schema" } };
      const extra = {};
      
      subscribeHandler(request, extra);
      expect(subscriptionManager.subscribe).toHaveBeenCalledWith("mysql://schema", "default");
    });
  });

  describe("UnsubscribeHandler", () => {
    let unsubscribeHandler: (req: unknown, extra: unknown) => unknown;

    beforeEach(() => {
      setupSubscriptions(mcpServer, subscriptionManager);
      const unsubscribeCall = (mcpServer.server.setRequestHandler as Record<string, unknown>).mock.calls.find(
        (call: unknown[]) => call[0] === "resources/unsubscribe"
      );
      unsubscribeHandler = unsubscribeCall[1];
    });

    it("should process unsubscribe request successfully", () => {
      const request = { params: { uri: "mysql://schema" } };
      const extra = { sessionId: "sess-123" };
      
      const result = unsubscribeHandler(request, extra);
      expect(result).toEqual({});
      expect(subscriptionManager.unsubscribe).toHaveBeenCalledWith("mysql://schema", "sess-123");
    });

    it("should fallback to header session ID if extra.sessionId is missing", () => {
      const request = { params: { uri: "mysql://schema" } };
      const extra = { http: { req: { headers: { get: (name: string) => name === "mcp-session-id" ? "sess-header" : null } } } };
      
      unsubscribeHandler(request, extra);
      expect(subscriptionManager.unsubscribe).toHaveBeenCalledWith("mysql://schema", "sess-header");
    });

    it("should fallback to 'default' session ID if none provided", () => {
      const request = { params: { uri: "mysql://schema" } };
      const extra = {};
      
      unsubscribeHandler(request, extra);
      expect(subscriptionManager.unsubscribe).toHaveBeenCalledWith("mysql://schema", "default");
    });
  });
});

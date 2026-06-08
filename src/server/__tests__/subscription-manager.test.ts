import { describe, it, expect, beforeEach, vi } from "vitest";
import { SubscriptionManager } from "../subscription-manager.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../../utils/logger.js";

// Mock logger
vi.mock("../../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

describe("SubscriptionManager", () => {
  let mockServer: any;
  let manager: SubscriptionManager;

  beforeEach(() => {
    vi.clearAllMocks();

    mockServer = {
      server: {
        sendResourceUpdated: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as McpServer;

    manager = new SubscriptionManager(mockServer);
  });

  describe("subscribe", () => {
    it("should ignore subscribe if no sessionId is provided", () => {
      manager.subscribe("mysql://health");
      expect(manager.hasSubscribers("mysql://health")).toBe(false);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("no sessionId provided"),
      );
    });

    it("should add a session to a resource subscription", () => {
      manager.subscribe("mysql://health", "session-1");
      expect(manager.hasSubscribers("mysql://health")).toBe(true);
    });

    it("should handle multiple sessions subscribing to the same resource", () => {
      manager.subscribe("mysql://health", "session-1");
      manager.subscribe("mysql://health", "session-2");

      expect(manager.hasSubscribers("mysql://health")).toBe(true);
    });

    it("should not duplicate existing subscriptions for the same session", () => {
      manager.subscribe("mysql://health", "session-1");
      manager.subscribe("mysql://health", "session-1");

      // We can infer it works if no error occurs and hasSubscribers is true.
      expect(manager.hasSubscribers("mysql://health")).toBe(true);
      
      // Should only log once for the actual subscription addition
      expect(logger.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe("unsubscribe", () => {
    it("should safely handle unsubscribe with no sessionId", () => {
      manager.subscribe("mysql://health", "session-1");
      manager.unsubscribe("mysql://health");
      expect(manager.hasSubscribers("mysql://health")).toBe(true);
    });

    it("should safely handle unsubscribe for non-existent resource", () => {
      manager.unsubscribe("mysql://nonexistent", "session-1");
      expect(manager.hasSubscribers("mysql://nonexistent")).toBe(false);
    });

    it("should safely handle unsubscribe for non-existent session", () => {
      manager.subscribe("mysql://health", "session-1");
      manager.unsubscribe("mysql://health", "session-2");
      expect(manager.hasSubscribers("mysql://health")).toBe(true);
    });

    it("should remove session from resource subscription", () => {
      manager.subscribe("mysql://health", "session-1");
      manager.subscribe("mysql://health", "session-2");
      
      manager.unsubscribe("mysql://health", "session-1");
      expect(manager.hasSubscribers("mysql://health")).toBe(true); // session-2 is still there
      
      manager.unsubscribe("mysql://health", "session-2");
      expect(manager.hasSubscribers("mysql://health")).toBe(false); // empty
    });
  });

  describe("unsubscribeSession", () => {
    it("should remove session from all its subscribed resources", () => {
      manager.subscribe("mysql://health", "session-1");
      manager.subscribe("mysql://schema", "session-1");
      manager.subscribe("mysql://health", "session-2");

      manager.unsubscribeSession("session-1");

      expect(manager.hasSubscribers("mysql://schema")).toBe(false);
      expect(manager.hasSubscribers("mysql://health")).toBe(true); // session-2 still active
    });
  });

  describe("notifyResourceUpdated", () => {
    it("should not call sendResourceUpdated if no subscribers", async () => {
      await manager.notifyResourceUpdated("mysql://health");
      expect(mockServer.server.sendResourceUpdated).not.toHaveBeenCalled();
    });

    it("should call sendResourceUpdated if subscribers exist", async () => {
      manager.subscribe("mysql://health", "session-1");
      await manager.notifyResourceUpdated("mysql://health");
      
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledWith({
        uri: "mysql://health",
      });
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Notified subscribers")
      );
    });

    it("should catch and log errors from sendResourceUpdated", async () => {
      const error = new Error("Transport error");
      mockServer.server.sendResourceUpdated.mockRejectedValueOnce(error);
      
      manager.subscribe("mysql://health", "session-1");
      
      await expect(manager.notifyResourceUpdated("mysql://health")).resolves.not.toThrow();
      
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to notify subscribers"),
        expect.objectContaining({ error: String(error) })
      );
    });
  });

  describe("notifySchemaSubscribers", () => {
    it("should notify mysql://schema and mysql://tables if they have subscribers", async () => {
      manager.subscribe("mysql://schema", "session-1");
      manager.subscribe("mysql://tables", "session-2");
      
      await manager.notifySchemaSubscribers();
      
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledTimes(2);
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledWith({ uri: "mysql://schema" });
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledWith({ uri: "mysql://tables" });
    });

    it("should notify any specific mysql://table/* URIs", async () => {
      manager.subscribe("mysql://table/users", "session-1");
      
      await manager.notifySchemaSubscribers();
      
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledWith({ uri: "mysql://table/users" });
    });

    it("should gracefully handle multiple URIs with overlapping promises", async () => {
      manager.subscribe("mysql://schema", "session-1");
      manager.subscribe("mysql://table/products", "session-1");
      
      await manager.notifySchemaSubscribers();
      
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledTimes(2);
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledWith({ uri: "mysql://schema" });
      expect(mockServer.server.sendResourceUpdated).toHaveBeenCalledWith({ uri: "mysql://table/products" });
    });
  });
});

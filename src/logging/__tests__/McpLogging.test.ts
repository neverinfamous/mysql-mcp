/**
 * mysql-mcp - MCP Logging Unit Tests
 *
 * Tests for McpLogger functionality including log level filtering,
 * configuration methods, and message sending.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a fresh McpLogger for each test by importing the class directly
// We need to test the class, not the singleton
describe("McpLogger", () => {
  let McpLogger: typeof import("../McpLogging.js").mcpLogger;
  let mockServer: {
    sendLoggingMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    // Import fresh module for each test
    vi.resetModules();
    const module = await import("../McpLogging.js");
    McpLogger = module.mcpLogger;

    mockServer = {
      sendLoggingMessage: vi.fn(),
    };
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("Configuration Methods", () => {
    it("should allow setting the server", () => {
      expect(() => McpLogger.setServer(mockServer as never)).not.toThrow();
    });

    it("should allow setting the logger name", () => {
      expect(() => McpLogger.setLoggerName("test-logger")).not.toThrow();
    });

    it("should allow enabling/disabling logging", () => {
      expect(() => McpLogger.setEnabled(false)).not.toThrow();
      expect(() => McpLogger.setEnabled(true)).not.toThrow();
    });

    it("should allow setting minimum log level", () => {
      expect(() => McpLogger.setMinLevel("debug")).not.toThrow();
      expect(() => McpLogger.setMinLevel("error")).not.toThrow();
    });
  });

  describe("Log Level Filtering", () => {
    beforeEach(() => {
      McpLogger.setServer(mockServer as never);
      McpLogger.setEnabled(true);
      McpLogger.setConnected(true);
    });

    it("should log messages at or above minimum level", () => {
      McpLogger.setMinLevel("info");
      McpLogger.info("test info message");

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "info",
          data: "test info message",
        }),
      );
    });

    it("should not log messages below minimum level", () => {
      McpLogger.setMinLevel("warning");
      McpLogger.debug("debug message");
      McpLogger.info("info message");

      expect(mockServer.sendLoggingMessage).not.toHaveBeenCalled();
    });

    it("should respect debug level filtering", () => {
      McpLogger.setMinLevel("debug");
      McpLogger.debug("debug message");

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "debug" }),
      );
    });

    it("should respect error level filtering", () => {
      McpLogger.setMinLevel("error");
      McpLogger.warning("warning message");
      McpLogger.error("error message");

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledTimes(1);
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "error" }),
      );
    });
  });

  describe("Convenience Methods", () => {
    beforeEach(() => {
      McpLogger.setServer(mockServer as never);
      McpLogger.setEnabled(true);
      McpLogger.setConnected(true);
      McpLogger.setMinLevel("debug");
    });

    it("should call debug with correct level", () => {
      McpLogger.debug("debug message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "debug" }),
      );
    });

    it("should call info with correct level", () => {
      McpLogger.info("info message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "info" }),
      );
    });

    it("should call notice with correct level", () => {
      McpLogger.notice("notice message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "notice" }),
      );
    });

    it("should call warning with correct level", () => {
      McpLogger.warning("warning message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "warning" }),
      );
    });

    it("should call error with correct level", () => {
      McpLogger.error("error message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "error" }),
      );
    });

    it("should call critical with correct level", () => {
      McpLogger.critical("critical message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "critical" }),
      );
    });

    it("should call alert with correct level", () => {
      McpLogger.alert("alert message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "alert" }),
      );
    });

    it("should call emergency with correct level", () => {
      McpLogger.emergency("emergency message");
      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({ level: "emergency" }),
      );
    });
  });

  describe("Data Handling", () => {
    beforeEach(() => {
      McpLogger.setServer(mockServer as never);
      McpLogger.setEnabled(true);
      McpLogger.setConnected(true);
      McpLogger.setMinLevel("debug");
    });

    it("should send message as string when no data provided", () => {
      McpLogger.info("simple message");

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: "simple message",
        }),
      );
    });

    it("should include additional data in message", () => {
      McpLogger.info("message with data", { key: "value", count: 42 });

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: "message with data",
            key: "value",
            count: 42,
          }),
        }),
      );
    });
  });

  describe("Disabled States", () => {
    it("should not log when disabled", () => {
      McpLogger.setServer(mockServer as never);
      McpLogger.setEnabled(false);

      McpLogger.info("should not be logged");

      expect(mockServer.sendLoggingMessage).not.toHaveBeenCalled();
    });

    it("should not log when server not set", () => {
      McpLogger.setEnabled(true);
      // Don't set server

      McpLogger.info("should not be logged");

      expect(mockServer.sendLoggingMessage).not.toHaveBeenCalled();
    });

    it("should handle sendLoggingMessage errors gracefully", () => {
      McpLogger.setServer(mockServer as never);
      McpLogger.setEnabled(true);
      McpLogger.setConnected(true);
      mockServer.sendLoggingMessage.mockImplementation(() => {
        throw new Error("Transport error");
      });

      // Should not throw
      expect(() => McpLogger.info("test")).not.toThrow();
    });
  });

  describe("Logger Name", () => {
    beforeEach(() => {
      McpLogger.setServer(mockServer as never);
      McpLogger.setEnabled(true);
      McpLogger.setConnected(true);
      McpLogger.setMinLevel("debug");
    });

    it("should use default logger name", () => {
      McpLogger.info("test");

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: "mysql-mcp",
        }),
      );
    });

    it("should use custom logger name when set", () => {
      McpLogger.setLoggerName("custom-logger");
      McpLogger.info("test");

      expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          logger: "custom-logger",
        }),
      );
    });
  });
});

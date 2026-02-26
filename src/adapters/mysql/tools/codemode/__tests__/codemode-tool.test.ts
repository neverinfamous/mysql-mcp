/**
 * mysql-mcp - Code Mode Tool Unit Tests
 *
 * Tests for createExecuteCodeTool, getCodeModeTools, and cleanupCodeMode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createExecuteCodeTool,
  getCodeModeTools,
  cleanupCodeMode,
} from "../index.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import type { ToolDefinition } from "../../../../../types/index.js";

// Suppress logger
vi.mock("../../../../../utils/logger.js", () => ({
  logger: { info: vi.fn(), warning: vi.fn(), error: vi.fn() },
}));

/**
 * Create a mock adapter sufficient for Code Mode usage
 */
function createCodeModeMockAdapter(): MySQLAdapter {
  const mockTools: ToolDefinition[] = [
    {
      name: "mysql_read_query",
      group: "core",
      title: "Read Query",
      description: "Execute a read query",
      inputSchema: { parse: (v: unknown) => v } as never,
      requiredScopes: ["read"],
      annotations: { readOnlyHint: true },
      handler: vi
        .fn()
        .mockResolvedValue({ rows: [{ id: 1 }], rowsAffected: 0 }),
    },
    {
      name: "mysql_write_query",
      group: "core",
      title: "Write Query",
      description: "Execute a write query",
      inputSchema: { parse: (v: unknown) => v } as never,
      requiredScopes: ["write"],
      annotations: {},
      handler: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 1 }),
    },
  ];

  return {
    type: "mysql",
    getToolDefinitions: vi.fn().mockReturnValue(mockTools),
    createContext: vi.fn().mockReturnValue({
      timestamp: new Date(),
      requestId: "test-ctx",
    }),
    getActiveTransactionIds: vi.fn().mockReturnValue([]),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
  } as unknown as MySQLAdapter;
}

describe("Code Mode Tool", () => {
  let mockAdapter: MySQLAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env["CODEMODE_ISOLATION"] = "vm";
    mockAdapter = createCodeModeMockAdapter();
  });

  afterEach(() => {
    cleanupCodeMode();
    delete process.env["CODEMODE_ISOLATION"];
  });

  // ===========================================================================
  // createExecuteCodeTool
  // ===========================================================================
  describe("createExecuteCodeTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createExecuteCodeTool(mockAdapter);
      expect(tool.name).toBe("mysql_execute_code");
      expect(tool.group).toBe("codemode");
      expect(tool.requiredScopes).toContain("admin");
    });

    it("should have proper annotations", () => {
      const tool = createExecuteCodeTool(mockAdapter);
      expect(tool.annotations?.destructiveHint).toBe(true);
      expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it("should reject invalid code (blocked patterns)", async () => {
      const tool = createExecuteCodeTool(mockAdapter);
      const result = (await tool.handler(
        { code: 'require("fs")' },
        { timestamp: new Date(), requestId: "test" },
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("validation failed");
    });

    it("should reject empty code", async () => {
      const tool = createExecuteCodeTool(mockAdapter);
      const result = (await tool.handler(
        { code: "" },
        { timestamp: new Date(), requestId: "test" },
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("validation failed");
    });

    it("should execute valid code successfully", async () => {
      const tool = createExecuteCodeTool(mockAdapter);
      const result = (await tool.handler(
        { code: "return 42" },
        { timestamp: new Date(), requestId: "test" },
      )) as { success: boolean; result: unknown; hint: string };

      expect(result.success).toBe(true);
      expect(result.result).toBe(42);
      expect(result.hint).toContain("mysql.help()");
    });

    it("should handle execution errors gracefully", async () => {
      const tool = createExecuteCodeTool(mockAdapter);
      const result = (await tool.handler(
        { code: 'throw new Error("test fail")' },
        { timestamp: new Date(), requestId: "test" },
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("test fail");
    });

    it("should cleanup orphaned transactions", async () => {
      // Simulate a transaction that starts during execution
      const getActiveIds = mockAdapter.getActiveTransactionIds as ReturnType<
        typeof vi.fn
      >;
      getActiveIds
        .mockReturnValueOnce([]) // before execution
        .mockReturnValueOnce(["orphan-txn-1"]); // after execution

      const tool = createExecuteCodeTool(mockAdapter);
      await tool.handler(
        { code: "return 'done'" },
        { timestamp: new Date(), requestId: "test" },
      );

      expect(mockAdapter.rollbackTransaction).toHaveBeenCalledWith(
        "orphan-txn-1",
      );
    });

    it("should handle rollback errors gracefully during cleanup", async () => {
      const getActiveIds = mockAdapter.getActiveTransactionIds as ReturnType<
        typeof vi.fn
      >;
      getActiveIds.mockReturnValueOnce([]).mockReturnValueOnce(["bad-txn"]);

      (
        mockAdapter.rollbackTransaction as ReturnType<typeof vi.fn>
      ).mockRejectedValueOnce(new Error("rollback failed"));

      const tool = createExecuteCodeTool(mockAdapter);
      // Should not throw even though rollback fails
      const result = (await tool.handler(
        { code: "return 'done'" },
        { timestamp: new Date(), requestId: "test" },
      )) as { success: boolean };

      expect(result.success).toBe(true);
    });
  });

  // ===========================================================================
  // getCodeModeTools
  // ===========================================================================
  describe("getCodeModeTools", () => {
    it("should return array with execute code tool", () => {
      const tools = getCodeModeTools(mockAdapter);
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("mysql_execute_code");
    });
  });

  // ===========================================================================
  // cleanupCodeMode
  // ===========================================================================
  describe("cleanupCodeMode", () => {
    it("should clean up without error when not initialized", () => {
      expect(() => cleanupCodeMode()).not.toThrow();
    });

    it("should clean up after initialization", async () => {
      // Initialize by executing
      const tool = createExecuteCodeTool(mockAdapter);
      await tool.handler(
        { code: "return 1" },
        { timestamp: new Date(), requestId: "test" },
      );
      // Clean up
      expect(() => cleanupCodeMode()).not.toThrow();
    });

    it("should allow re-initialization after cleanup", async () => {
      const tool = createExecuteCodeTool(mockAdapter);
      await tool.handler(
        { code: "return 1" },
        { timestamp: new Date(), requestId: "test" },
      );
      cleanupCodeMode();

      // Re-execute should work
      const result = (await tool.handler(
        { code: "return 2" },
        { timestamp: new Date(), requestId: "test" },
      )) as { success: boolean; result: unknown };

      expect(result.success).toBe(true);
      expect(result.result).toBe(2);
    });
  });
});

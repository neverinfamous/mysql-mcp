/**
 * mysql-mcp - Sys Schema Error Path Tests
 *
 * Tests for error handling (ZodError, database errors) across all sysschema tools.
 * These tests specifically target the catch blocks that are missed by happy-path tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSysUserSummaryTool,
  createSysHostSummaryTool,
} from "../activity.js";
import {
  createSysStatementSummaryTool,
  createSysWaitSummaryTool,
  createSysIOSummaryTool,
} from "../performance.js";
import {
  createSysSchemaStatsTool,
  createSysInnoDBLockWaitsTool,
  createSysMemorySummaryTool,
} from "../resources.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Sys Schema Error Paths", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  // ===========================================================================
  // Activity tools error paths
  // ===========================================================================
  describe("activity error paths", () => {
    it("should handle database error in user summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("DB connection lost"),
      );
      const tool = createSysUserSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("DB connection lost");
    });

    it("should handle non-Error thrown in user summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue("string error");
      const tool = createSysUserSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe("string error");
    });

    it("should handle database error in host summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("DB timeout"));
      const tool = createSysHostSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("DB timeout");
    });

    it("should handle non-Error thrown in host summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(42);
      const tool = createSysHostSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe("42");
    });
  });

  // ===========================================================================
  // Performance tools error paths
  // ===========================================================================
  describe("performance error paths", () => {
    it("should handle database error in statement summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Query failed"));
      const tool = createSysStatementSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("Query failed");
    });

    it("should handle database error in wait summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Wait query error"));
      const tool = createSysWaitSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("Wait query error");
    });

    it("should handle database error in IO summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("IO query error"));
      const tool = createSysIOSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("IO query error");
    });

    it("should handle non-Error thrown in statement summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue("raw string");
      const tool = createSysStatementSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toBe("raw string");
    });
  });

  // ===========================================================================
  // Resources tools error paths
  // ===========================================================================
  describe("resources error paths", () => {
    it("should handle database error in schema stats", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Schema error"));
      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("Schema error");
    });

    it("should handle database error in innodb lock waits", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Lock error"));
      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("Lock error");
    });

    it("should handle database error in memory summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Memory error"));
      const tool = createSysMemorySummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("Memory error");
    });

    it("should handle non-Error thrown in lock waits", async () => {
      mockAdapter.executeQuery.mockRejectedValue({ code: "UNKNOWN" });
      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
    });

    it("should handle non-Error thrown in memory summary", async () => {
      mockAdapter.executeQuery.mockRejectedValue(undefined);
      const tool = createSysMemorySummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
    });
  });
});

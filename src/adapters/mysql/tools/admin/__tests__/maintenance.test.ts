/**
 * mysql-mcp - Admin Maintenance Tools Unit Tests
 *
 * Comprehensive tests for maintenance.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createOptimizeTableTool,
  createAnalyzeTableTool,
  createCheckTableTool,
  createRepairTableTool,
  createFlushTablesTool,
  createKillQueryTool,
} from "../maintenance.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Admin Maintenance Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createOptimizeTableTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_optimize_table");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.readOnlyHint).toBe(false);
      expect(tool.annotations?.idempotentHint).toBe(true);
    });

    it("should execute OPTIMIZE TABLE for single table", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Table: "users",
            Op: "optimize",
            Msg_type: "status",
            Msg_text: "OK",
          },
        ]),
      );

      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: ["users"] }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "OPTIMIZE TABLE `users`",
      );
      expect(result).toHaveProperty("results");
      expect(Array.isArray((result as { results: unknown[] }).results)).toBe(
        true,
      );
    });

    it("should execute OPTIMIZE TABLE for multiple tables", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        { tables: ["users", "orders", "products"] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "OPTIMIZE TABLE `users`, `orders`, `products`",
      );
    });

    it("should handle table names with special characters", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ tables: ["table-name", "table.name"] }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("`table-name`");
      expect(call).toContain("`table.name`");
    });
  });

  describe("createAnalyzeTableTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createAnalyzeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_analyze_table");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.idempotentHint).toBe(true);
    });

    it("should execute ANALYZE TABLE for single table", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Table: "products",
            Op: "analyze",
            Msg_type: "status",
            Msg_text: "OK",
          },
        ]),
      );

      const tool = createAnalyzeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: ["products"] }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "ANALYZE TABLE `products`",
      );
      expect(result).toHaveProperty("results");
    });

    it("should execute ANALYZE TABLE for multiple tables", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createAnalyzeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ tables: ["table1", "table2"] }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "ANALYZE TABLE `table1`, `table2`",
      );
    });
  });

  describe("createCheckTableTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);

      expect(tool.name).toBe("mysql_check_table");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should execute CHECK TABLE without option", async () => {
      mockAdapter.rawQuery.mockResolvedValue(
        createMockQueryResult([
          { Table: "users", Op: "check", Msg_type: "status", Msg_text: "OK" },
        ]),
      );

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ tables: ["users"] }, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith("CHECK TABLE `users`");
      expect(result).toHaveProperty("results");
      expect(result).toHaveProperty("rowCount");
    });

    it("should execute CHECK TABLE with EXTENDED option", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        { tables: ["users"], option: "EXTENDED" },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith(
        "CHECK TABLE `users` EXTENDED",
      );
    });

    it("should execute CHECK TABLE with QUICK option", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ tables: ["orders"], option: "QUICK" }, mockContext);

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith(
        "CHECK TABLE `orders` QUICK",
      );
    });

    it("should execute CHECK TABLE for multiple tables with option", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        { tables: ["t1", "t2"], option: "MEDIUM" },
        mockContext,
      );

      expect(mockAdapter.rawQuery).toHaveBeenCalledWith(
        "CHECK TABLE `t1`, `t2` MEDIUM",
      );
    });

    it("should handle empty result rows", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { tables: ["users"] },
        mockContext,
      )) as { results: unknown[]; rowCount: number };

      expect(result.results).toEqual([]);
      expect(result.rowCount).toBe(0);
    });

    it("should handle missing rows property", async () => {
      mockAdapter.rawQuery.mockResolvedValue({
        rows: undefined,
        rowsAffected: 0,
        executionTimeMs: 5,
      });

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { tables: ["users"] },
        mockContext,
      )) as { results: unknown[]; rowCount: number };

      expect(result.results).toEqual([]);
      expect(result.rowCount).toBe(0);
    });
  });

  describe("createRepairTableTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_repair_table");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.destructiveHint).toBeUndefined(); // Not destructive
    });

    it("should execute REPAIR TABLE without QUICK option", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Table: "myisam_table",
            Op: "repair",
            Msg_type: "status",
            Msg_text: "OK",
          },
        ]),
      );

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { tables: ["myisam_table"] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `myisam_table`",
      );
      expect(result).toHaveProperty("results");
    });

    it("should execute REPAIR TABLE with QUICK option", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ tables: ["old_table"], quick: true }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `old_table` QUICK",
      );
    });

    it("should default quick to false when not provided", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ tables: ["table1"] }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).not.toContain("QUICK");
    });

    it("should execute REPAIR TABLE for multiple tables", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ tables: ["t1", "t2"], quick: false }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `t1`, `t2`",
      );
    });
  });

  describe("createFlushTablesTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_flush_tables");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.idempotentHint).toBe(true);
    });

    it("should execute FLUSH TABLES for all tables when none specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith("FLUSH TABLES");
      expect(result).toEqual({ success: true });
    });

    it("should execute FLUSH TABLES for all tables when undefined", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: undefined }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith("FLUSH TABLES");
      expect(result).toEqual({ success: true });
    });

    it("should execute FLUSH TABLES for all tables when empty array", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: [] }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith("FLUSH TABLES");
      expect(result).toEqual({ success: true });
    });

    it("should execute FLUSH TABLES for specific table", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: ["users"] }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "FLUSH TABLES `users`",
      );
      expect(result).toEqual({ success: true });
    });

    it("should execute FLUSH TABLES for multiple specific tables", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { TABLE_NAME: "users" },
          { TABLE_NAME: "orders" },
          { TABLE_NAME: "products" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        { tables: ["users", "orders", "products"] },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "FLUSH TABLES `users`, `orders`, `products`",
      );
    });
  });

  describe("createKillQueryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);

      expect(tool.name).toBe("mysql_kill_query");
      expect(tool.group).toBe("admin");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.readOnlyHint).toBe(false);
      expect(tool.annotations?.destructiveHint).toBe(true);
    });

    it("should execute KILL QUERY by default", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ processId: 12345 }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith("KILL QUERY 12345");
      expect(result).toEqual({ success: true, killed: 12345, type: "QUERY" });
    });

    it("should execute KILL QUERY when connection is false", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { processId: 999, connection: false },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith("KILL QUERY 999");
      expect(result).toEqual({ success: true, killed: 999, type: "QUERY" });
    });

    it("should execute KILL CONNECTION when connection is true", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { processId: 54321, connection: true },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "KILL CONNECTION 54321",
      );
      expect(result).toEqual({
        success: true,
        killed: 54321,
        type: "CONNECTION",
      });
    });

    it("should handle various process ID formats", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);

      // Test with number
      await tool.handler({ processId: 1 }, mockContext);
      expect(mockAdapter.executeQuery).toHaveBeenLastCalledWith("KILL QUERY 1");

      // Test with larger number
      await tool.handler({ processId: 2147483647 }, mockContext);
      expect(mockAdapter.executeQuery).toHaveBeenLastCalledWith(
        "KILL QUERY 2147483647",
      );
    });

    it("should return structured error for unknown thread ID", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Unknown thread id: 999999"),
      );

      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ processId: 999999 }, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Process ID 999999 not found",
      });
    });

    it("should return structured error for non-thread-id errors", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Connection lost"));

      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ processId: 123 }, mockContext);

      expect(result).toEqual({ success: false, error: "Connection lost" });
    });
  });

  describe("DDL handler error handling", () => {
    it("mysql_optimize_table should return structured error on adapter failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table storage engine mismatch"),
      );

      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: ["users"] }, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Table storage engine mismatch",
      });
    });

    it("mysql_optimize_table should return structured error on empty tables", async () => {
      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("mysql_analyze_table should return structured error on adapter failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Access denied for user"),
      );

      const tool = createAnalyzeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: ["products"] }, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Access denied for user",
      });
    });

    it("mysql_analyze_table should return structured error on empty tables", async () => {
      const tool = createAnalyzeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("mysql_check_table should return structured error on adapter failure", async () => {
      mockAdapter.rawQuery.mockRejectedValue(
        new Error("Lock wait timeout exceeded"),
      );

      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ tables: ["orders"] }, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Lock wait timeout exceeded",
      });
    });

    it("mysql_check_table should return structured error on empty tables", async () => {
      const tool = createCheckTableTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });

    it("mysql_repair_table should return structured error on adapter failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table is read only"),
      );

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ tables: ["broken"] }, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Table is read only",
      });
    });

    it("mysql_repair_table should return structured error on empty tables", async () => {
      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
    });
  });

  describe("repair_table alias support", () => {
    it("should accept table alias (singular string)", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `users`",
      );
    });

    it("should accept tableName alias", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ tableName: "orders" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `orders`",
      );
    });

    it("should accept name alias", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ name: "products" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `products`",
      );
    });

    it("should prefer tables array over aliases", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        { tables: ["t1", "t2"], table: "ignored" },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "REPAIR TABLE `t1`, `t2`",
      );
    });
  });

  describe("rowCount consistency", () => {
    it("mysql_optimize_table should include rowCount", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { Table: "t1", Op: "optimize", Msg_type: "status", Msg_text: "OK" },
          { Table: "t2", Op: "optimize", Msg_type: "status", Msg_text: "OK" },
        ]),
      );

      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { tables: ["t1", "t2"] },
        mockContext,
      )) as { results: unknown[]; rowCount: number };

      expect(result.rowCount).toBe(2);
    });

    it("mysql_analyze_table should include rowCount", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { Table: "t1", Op: "analyze", Msg_type: "status", Msg_text: "OK" },
        ]),
      );

      const tool = createAnalyzeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ tables: ["t1"] }, mockContext)) as {
        results: unknown[];
        rowCount: number;
      };

      expect(result.rowCount).toBe(1);
    });

    it("mysql_repair_table should include rowCount", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            Table: "t1",
            Op: "repair",
            Msg_type: "note",
            Msg_text: "not supported",
          },
        ]),
      );

      const tool = createRepairTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ tables: ["t1"] }, mockContext)) as {
        results: unknown[];
        rowCount: number;
      };

      expect(result.rowCount).toBe(1);
    });
  });

  describe("flush table existence check", () => {
    it("should flush valid tables and return notFound for nonexistent ones", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { tables: ["users", "nonexistent_xyz"] },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        notFound: ["nonexistent_xyz"],
        flushed: ["users"],
      });
      // Should have flushed the valid table
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "FLUSH TABLES `users`",
      );
    });

    it("should return notFound with empty flushed when no tables exist", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { tables: ["nonexistent_a", "nonexistent_b"] },
        mockContext,
      );

      expect(result).toEqual({
        success: false,
        notFound: ["nonexistent_a", "nonexistent_b"],
        flushed: [],
      });
      // Should NOT have called executeQuery (no valid tables to flush)
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });

    it("should flush when all tables exist", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { TABLE_NAME: "users" },
          { TABLE_NAME: "orders" },
        ]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { tables: ["users", "orders"] },
        mockContext,
      );

      expect(result).toEqual({ success: true });
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        "FLUSH TABLES `users`, `orders`",
      );
    });

    it("should return structured error on Zod validation failure", async () => {
      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      // Pass invalid type for tables (number instead of array)
      const result = await tool.handler(
        { tables: 12345 as unknown },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      // Should NOT throw — should return structured response
      expect(typeof (result as { error: string }).error).toBe("string");
    });

    it("should return structured error on adapter failure", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Access denied; you need the RELOAD privilege"),
      );

      const tool = createFlushTablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(result).toEqual({
        success: false,
        error: "Access denied; you need the RELOAD privilege",
      });
    });
  });

  describe("kill_query Zod validation", () => {
    it("should return structured error when processId is missing", async () => {
      const tool = createKillQueryTool(mockAdapter as unknown as MySQLAdapter);
      // Pass empty params — processId is required
      const result = await tool.handler({}, mockContext);

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty("error");
      expect(typeof (result as { error: string }).error).toBe("string");
    });
  });

  describe("Zod error human-readability", () => {
    it("should return human-readable error messages, not raw JSON arrays", async () => {
      const tool = createOptimizeTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      // Empty params triggers Zod validation error
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      // The error should NOT be a raw JSON array string (starting with "[{")
      expect(result.error).not.toMatch(/^\s*\[/);
      // Should be a clean human-readable message
      expect(result.error).toBeTruthy();
    });
  });
});

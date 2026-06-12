/**
 * mysql-mcp - Performance Optimization Tools Unit Tests
 *
 * Comprehensive tests for optimization.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createQueryRewriteTool,
  createForceIndexTool,
  createOptimizerTraceTool,
} from "../optimization.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
  createMockTableInfo,
} from "../../../../../__tests__/mocks/index.js";

describe("Performance Optimization Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createQueryRewriteTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      expect(tool.name).toBe("mysql_query_rewrite");
    });

    it("should suggest optimizations for SELECT *", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      )) as { data: { suggestions: string[] } };

      expect(result.data.suggestions).toContain(
        "Consider selecting only needed columns instead of SELECT *",
      );
    });

    it("should suggest optimizations for missing LIMIT", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT id FROM users" },
        mockContext,
      )) as { data: { suggestions: string[] } };

      expect(result.data.suggestions).toContain(
        "Consider adding LIMIT to prevent large result sets",
      );
    });

    it("should suggest optimizations for leading wildcard LIKE", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT id FROM users WHERE name LIKE '%Bob'" },
        mockContext,
      )) as { data: { suggestions: string[] } };

      expect(result.data.suggestions).toContain(
        "Leading wildcard in LIKE prevents index usage; consider FULLTEXT search",
      );
    });

    it("should return explain plan if possible", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            EXPLAIN: JSON.stringify({ query_block: {} }),
          },
        ]),
      );

      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      )) as { data: { explainPlan: unknown } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.data.explainPlan).toBeDefined();
    });

    it("should handle explain failure gracefully with explainError", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      )) as { data: { explainPlan: unknown; explainError: string } };

      expect(result.data.explainPlan).toBeNull();
      expect(result.data.explainError).toBe(
        "Table 'testdb.nonexistent' doesn't exist",
      );
    });

    it("should accept sql alias for query parameter", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { sql: "SELECT * FROM users" },
        mockContext,
      )) as { data: { originalQuery: string; suggestions: string[] } };

      expect(result.data.originalQuery).toBe("SELECT * FROM users");
      expect(result.data.suggestions).toContain(
        "Consider selecting only needed columns instead of SELECT *",
      );
    });
  });

  describe("createForceIndexTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createForceIndexTool(mockAdapter);
      expect(tool.name).toBe("mysql_force_index");
    });

    it("should rewrite query with FORCE INDEX", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "PRIMARY",
    title: "PRIMARY",
          tableName: "users",
          columns: ["id"],
          unique: true,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM users WHERE id = 1",
          indexName: "PRIMARY",
        },
        mockContext,
      )) as { data: { rewrittenQuery: string } };

      expect(result.data.rewrittenQuery).toBe(
        "SELECT * FROM `users` FORCE INDEX (`PRIMARY`) WHERE id = 1",
      );
    });

    it("should handle table name with backticks in query", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "idx_name",
    title: "Idx Name",
          tableName: "users",
          columns: ["name"],
          unique: false,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM `users` WHERE id = 1",
          indexName: "idx_name",
        },
        mockContext,
      )) as { data: { rewrittenQuery: string; warning?: string } };

      expect(result.data.rewrittenQuery).toBe(
        "SELECT * FROM `users` FORCE INDEX (`idx_name`) WHERE id = 1",
      );
      expect(result.data.warning).toBeUndefined();
    });

    it("should return error for nonexistent index", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "PRIMARY",
    title: "PRIMARY",
          tableName: "users",
          columns: ["id"],
          unique: true,
          type: "BTREE",
        },
      ]);
      const mockTableInfo = createMockTableInfo("users");
      mockTableInfo.columns = [
        { name: "id", type: "int", nullable: false, primaryKey: true },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      const tool = createForceIndexTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM users WHERE id = 1",
          indexName: "nonexistent_idx",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "Index 'nonexistent_idx' not found on table 'users'",
      );
    });

    it("should return structured error for nonexistent table (P154)", async () => {
      const mockTableInfo = createMockTableInfo("ghost");
      mockTableInfo.columns = [];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      const tool = createForceIndexTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "ghost",
          query: "SELECT * FROM ghost WHERE id = 1",
          indexName: "some_idx",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Table 'ghost' does not exist");
      expect(mockAdapter.getTableIndexes).not.toHaveBeenCalled();
    });
  });

  describe("createOptimizerTraceTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createOptimizerTraceTool(
        mockAdapter,
      );
      expect(tool.name).toBe("mysql_optimizer_trace");
    });

    it("should execute optimizer trace flow", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // The query
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: "{}" }])); // The trace

      const tool = createOptimizerTraceTool(
        mockAdapter,
      );
      const result = await tool.handler(
        { query: "SELECT * FROM users", summary: false },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        1,
        'SET optimizer_trace="enabled=on"',
      );
      expect(mockAdapter.executeReadQuery).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM users",
      );
      expect(mockAdapter.executeReadQuery).toHaveBeenNthCalledWith(
        2,
        "SELECT * FROM information_schema.OPTIMIZER_TRACE",
      );
      expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
        2,
        'SET optimizer_trace="enabled=off"',
      );

      expect(Reflect.get(result || {}, "data")).toHaveProperty("trace");
    });

    it("should handle query execution failure gracefully", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createOptimizerTraceTool(
        mockAdapter,
      );

      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent", summary: false },
        mockContext,
      )) as { data: { query: string; trace: null }; error: string };

      expect(result.data.query).toBe("SELECT * FROM nonexistent");
      expect(result.data.trace).toBeNull();
      expect(result.error).toBe("Table 'testdb.nonexistent' doesn't exist");

      // Verify optimizer trace is still disabled
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        'SET optimizer_trace="enabled=off"',
      );
    });

    it("should handle query failure gracefully in summary mode", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.ghost' doesn't exist"),
      );

      const tool = createOptimizerTraceTool(
        mockAdapter,
      );

      const result = (await tool.handler(
        { query: "SELECT * FROM ghost", summary: true },
        mockContext,
      )) as { data: { query: string; decisions: unknown[] }; error: string };

      expect(result.data.query).toBe("SELECT * FROM ghost");
      expect(result.data.decisions).toEqual([]);
      expect(result.error).toBe("Table 'testdb.ghost' doesn't exist");

      // Verify optimizer trace is still disabled
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        'SET optimizer_trace="enabled=off"',
      );
    });

    it("should strip adapter prefix from query execution error", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error(
          "Query failed: Execute failed: Table 'testdb.ghost' doesn't exist",
        ),
      );

      const tool = createOptimizerTraceTool(
        mockAdapter,
      );

      const result = (await tool.handler(
        { query: "SELECT * FROM ghost", summary: false },
        mockContext,
      )) as { data: { query: string; trace: null }; error: string };

      expect(result.data.query).toBe("SELECT * FROM ghost");
      expect(result.data.trace).toBeNull();
      expect(result.error).toBe("Table 'testdb.ghost' doesn't exist");
    });

    it("should accept sql alias for query parameter", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // The query
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: "{}" }])); // The trace

      const tool = createOptimizerTraceTool(
        mockAdapter,
      );
      const result = await tool.handler(
        { sql: "SELECT * FROM users", summary: false },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM users",
      );
      expect(Reflect.get(result || {}, "data")).toHaveProperty("trace");
    });

    it("should return structured error when trace fetch fails", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // The query succeeds
        .mockRejectedValueOnce(new Error("Access denied for OPTIMIZER_TRACE")); // The trace fetch fails

      const tool = createOptimizerTraceTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Access denied for OPTIMIZER_TRACE");

      // Verify optimizer trace is still disabled in finally block
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        'SET optimizer_trace="enabled=off"',
      );
    });
  });

  describe("alias support", () => {
    it("mysql_force_index should accept tableName alias", async () => {
      const mockTableInfo = createMockTableInfo("users");
      mockTableInfo.columns = [
        { name: "id", type: "int", nullable: false, primaryKey: true },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "idx_name",
    title: "Idx Name",
          tableName: "users",
          columns: ["name"],
          unique: false,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter);
      const result = (await tool.handler(
        {
          tableName: "users",
          query: "SELECT * FROM users WHERE name = 'test'",
          indexName: "idx_name",
        },
        mockContext,
      )) as { data: { rewrittenQuery: string } };

      expect(result.data.rewrittenQuery).toContain("FORCE INDEX");
      expect(mockAdapter.describeTable).toHaveBeenCalledWith("users");
    });
  });

  describe("try/catch error handling", () => {
    it("mysql_force_index should return structured error on adapter throw", async () => {
      mockAdapter.describeTable.mockRejectedValue(new Error("Connection lost"));

      const tool = createForceIndexTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM users",
          indexName: "idx_name",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection lost");
    });

    it("mysql_query_rewrite should return structured error on parse failure", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("mysql_optimizer_trace should return structured error on missing query", async () => {
      const tool = createOptimizerTraceTool(
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Verify optimizer trace was never enabled (parse failed before SET)
      expect(mockAdapter.executeQuery).not.toHaveBeenCalledWith(
        'SET optimizer_trace="enabled=on"',
      );
    });

    it("mysql_query_rewrite should strip adapter prefix from explainError", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error(
          "Query failed: Execute failed: Table 'testdb.ghost' doesn't exist",
        ),
      );

      const tool = createQueryRewriteTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM ghost" },
        mockContext,
      )) as { data: { explainPlan: unknown; explainError: string } };

      expect(result.data.explainPlan).toBeNull();
      expect(result.data.explainError).toBe(
        "Table 'testdb.ghost' doesn't exist",
      );
    });
  });
});

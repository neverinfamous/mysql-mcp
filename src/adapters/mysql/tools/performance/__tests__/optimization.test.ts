/**
 * mysql-mcp - Performance Optimization Tools Unit Tests
 *
 * Comprehensive tests for optimization.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createIndexRecommendationTool,
  createQueryRewriteTool,
  createForceIndexTool,
  createOptimizerTraceTool,
} from "../optimization.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
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

  describe("createIndexRecommendationTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_index_recommendation");
      expect(tool.group).toBe("optimization");
      expect(tool.requiredScopes).toContain("read");
    });

    it("should recommend indexes for ID and foreign key columns", async () => {
      const mockTableInfo = createMockTableInfo("orders");
      mockTableInfo.columns = [
        { name: "id", type: "int", nullable: false, primaryKey: true },
        { name: "user_id", type: "int", nullable: false, primaryKey: false },
        { name: "status", type: "varchar", nullable: false, primaryKey: false },
        {
          name: "created_at",
          type: "datetime",
          nullable: false,
          primaryKey: false,
        },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      // Return only primary key index
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "PRIMARY",
          tableName: "orders",
          columns: ["id"],
          unique: true,
          type: "BTREE",
        },
      ]);

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ table: "orders" }, mockContext)) as {
        recommendations: unknown[];
      };

      expect(mockAdapter.describeTable).toHaveBeenCalledWith("orders");
      expect(result.recommendations).toHaveLength(3);

      // Check specific recommendations
      const recs = result.recommendations as {
        column: string;
        reason: string;
      }[];
      expect(recs.find((r) => r.column === "user_id")).toBeDefined(); // Foreign key pattern
      expect(recs.find((r) => r.column === "status")).toBeDefined(); // Status column
      expect(recs.find((r) => r.column === "created_at")).toBeDefined(); // Timestamp
    });

    it("should not recommend indexes for already indexed columns", async () => {
      const mockTableInfo = createMockTableInfo("orders");
      mockTableInfo.columns = [
        { name: "user_id", type: "int", nullable: false, primaryKey: false },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      // user_id is already indexed
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "idx_user_id",
          tableName: "orders",
          columns: ["user_id"],
          unique: false,
          type: "BTREE",
        },
      ]);

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ table: "orders" }, mockContext)) as {
        recommendations: unknown[];
      };

      expect(result.recommendations).toHaveLength(0);
    });

    it("should return exists: false for nonexistent table", async () => {
      const mockTableInfo = createMockTableInfo("ghost");
      mockTableInfo.columns = [];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ table: "ghost" }, mockContext)) as {
        exists: boolean;
        table: string;
      };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("ghost");
      expect(mockAdapter.getTableIndexes).not.toHaveBeenCalled();
    });
  });

  describe("createQueryRewriteTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_query_rewrite");
    });

    it("should suggest optimizations for SELECT *", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      )) as { suggestions: string[] };

      expect(result.suggestions).toContain(
        "Consider selecting only needed columns instead of SELECT *",
      );
    });

    it("should suggest optimizations for missing LIMIT", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT id FROM users" },
        mockContext,
      )) as { suggestions: string[] };

      expect(result.suggestions).toContain(
        "Consider adding LIMIT to prevent large result sets",
      );
    });

    it("should suggest optimizations for leading wildcard LIKE", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT id FROM users WHERE name LIKE '%Bob'" },
        mockContext,
      )) as { suggestions: string[] };

      expect(result.suggestions).toContain(
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
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      )) as { explainPlan: unknown };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.explainPlan).toBeDefined();
    });

    it("should handle explain failure gracefully with explainError", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      )) as { explainPlan: unknown; explainError: string };

      expect(result.explainPlan).toBeNull();
      expect(result.explainError).toBe(
        "Table 'testdb.nonexistent' doesn't exist",
      );
    });

    it("should accept sql alias for query parameter", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { sql: "SELECT * FROM users" },
        mockContext,
      )) as { originalQuery: string; suggestions: string[] };

      expect(result.originalQuery).toBe("SELECT * FROM users");
      expect(result.suggestions).toContain(
        "Consider selecting only needed columns instead of SELECT *",
      );
    });
  });

  describe("createForceIndexTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      expect(tool.name).toBe("mysql_force_index");
    });

    it("should rewrite query with FORCE INDEX", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "PRIMARY",
          tableName: "users",
          columns: ["id"],
          unique: true,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM users WHERE id = 1",
          indexName: "PRIMARY",
        },
        mockContext,
      )) as { rewrittenQuery: string };

      expect(result.rewrittenQuery).toBe(
        "SELECT * FROM `users` FORCE INDEX (`PRIMARY`) WHERE id = 1",
      );
    });

    it("should handle table name with backticks in query", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "idx_name",
          tableName: "users",
          columns: ["name"],
          unique: false,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM `users` WHERE id = 1",
          indexName: "idx_name",
        },
        mockContext,
      )) as { rewrittenQuery: string; warning?: string };

      expect(result.rewrittenQuery).toBe(
        "SELECT * FROM `users` FORCE INDEX (`idx_name`) WHERE id = 1",
      );
      expect(result.warning).toBeUndefined();
    });

    it("should include warning for nonexistent index", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "PRIMARY",
          tableName: "users",
          columns: ["id"],
          unique: true,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM users WHERE id = 1",
          indexName: "nonexistent_idx",
        },
        mockContext,
      )) as { rewrittenQuery: string; warning: string };

      expect(result.rewrittenQuery).toContain("FORCE INDEX");
      expect(result.warning).toBe(
        "Index 'nonexistent_idx' not found on table 'users'",
      );
    });

    it("should return exists: false for nonexistent table (P154)", async () => {
      const mockTableInfo = createMockTableInfo("ghost");
      mockTableInfo.columns = [];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "ghost",
          query: "SELECT * FROM ghost WHERE id = 1",
          indexName: "some_idx",
        },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("ghost");
      expect(mockAdapter.getTableIndexes).not.toHaveBeenCalled();
    });
  });

  describe("createOptimizerTraceTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_optimizer_trace");
    });

    it("should execute optimizer trace flow", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // The query
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: "{}" }])); // The trace

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { query: "SELECT * FROM users" },
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

      expect(result).toHaveProperty("trace");
    });

    it("should handle query execution failure gracefully", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      )) as { query: string; trace: null; error: string };

      expect(result.query).toBe("SELECT * FROM nonexistent");
      expect(result.trace).toBeNull();
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
        mockAdapter as unknown as MySQLAdapter,
      );

      const result = (await tool.handler(
        { query: "SELECT * FROM ghost", summary: true },
        mockContext,
      )) as { query: string; decisions: unknown[]; error: string };

      expect(result.query).toBe("SELECT * FROM ghost");
      expect(result.decisions).toEqual([]);
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
        mockAdapter as unknown as MySQLAdapter,
      );

      const result = (await tool.handler(
        { query: "SELECT * FROM ghost" },
        mockContext,
      )) as { query: string; trace: null; error: string };

      expect(result.query).toBe("SELECT * FROM ghost");
      expect(result.trace).toBeNull();
      expect(result.error).toBe("Table 'testdb.ghost' doesn't exist");
    });

    it("should accept sql alias for query parameter", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // The query
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: "{}" }])); // The trace

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { sql: "SELECT * FROM users" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenNthCalledWith(
        1,
        "SELECT * FROM users",
      );
      expect(result).toHaveProperty("trace");
    });

    it("should return structured error when trace fetch fails", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // The query succeeds
        .mockRejectedValueOnce(new Error("Access denied for OPTIMIZER_TRACE")); // The trace fetch fails

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
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
    it("mysql_index_recommendation should accept tableName alias", async () => {
      const mockTableInfo = createMockTableInfo("orders");
      mockTableInfo.columns = [
        { name: "id", type: "int", nullable: false, primaryKey: true },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "PRIMARY",
          tableName: "orders",
          columns: ["id"],
          unique: true,
          type: "BTREE",
        },
      ]);

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { tableName: "orders" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(true);
      expect(result.table).toBe("orders");
      expect(mockAdapter.describeTable).toHaveBeenCalledWith("orders");
    });

    it("mysql_force_index should accept tableName alias", async () => {
      const mockTableInfo = createMockTableInfo("users");
      mockTableInfo.columns = [
        { name: "id", type: "int", nullable: false, primaryKey: true },
      ];
      mockAdapter.describeTable.mockResolvedValue(mockTableInfo);
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "idx_name",
          tableName: "users",
          columns: ["name"],
          unique: false,
          type: "BTREE",
        },
      ]);

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          tableName: "users",
          query: "SELECT * FROM users WHERE name = 'test'",
          indexName: "idx_name",
        },
        mockContext,
      )) as { rewrittenQuery: string };

      expect(result.rewrittenQuery).toContain("FORCE INDEX");
      expect(mockAdapter.describeTable).toHaveBeenCalledWith("users");
    });
  });

  describe("try/catch error handling", () => {
    it("mysql_index_recommendation should return structured error on adapter throw", async () => {
      mockAdapter.describeTable.mockRejectedValue(new Error("Connection lost"));

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ table: "users" }, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection lost");
    });

    it("mysql_force_index should return structured error on adapter throw", async () => {
      mockAdapter.describeTable.mockRejectedValue(new Error("Connection lost"));

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
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
        mockAdapter as unknown as MySQLAdapter,
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
        mockAdapter as unknown as MySQLAdapter,
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
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM ghost" },
        mockContext,
      )) as { explainPlan: unknown; explainError: string };

      expect(result.explainPlan).toBeNull();
      expect(result.explainError).toBe("Table 'testdb.ghost' doesn't exist");
    });
  });
});

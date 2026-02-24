/**
 * mysql-mcp - Performance Analysis Tools Unit Tests
 *
 * Comprehensive tests for analysis.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createExplainTool,
  createExplainAnalyzeTool,
  createSlowQueriesTool,
  createQueryStatsTool,
  createIndexUsageTool,
  createTableStatsTool,
  createBufferPoolStatsTool,
  createThreadStatsTool,
} from "../analysis.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Performance Analysis Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createExplainTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);

      expect(tool.name).toBe("mysql_explain");
      expect(tool.group).toBe("performance");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should run EXPLAIN for query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            id: 1,
            select_type: "SIMPLE",
            table: "users",
            type: "ALL",
          },
        ]),
      );

      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { query: "SELECT * FROM users", format: "TRADITIONAL" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "EXPLAIN FORMAT=TRADITIONAL SELECT * FROM users",
      );
      expect(result).toHaveProperty("plan");
    });

    it("should run EXPLAIN with TREE format", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            EXPLAIN: "-> Table scan on users  (cost=1.00 rows=100)",
          },
        ]),
      );

      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { query: "SELECT * FROM users", format: "TREE" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "EXPLAIN FORMAT=TREE SELECT * FROM users",
      );
      expect(result).toHaveProperty("plan");
    });

    it("should run EXPLAIN with JSON format", async () => {
      const mockPlan = {
        query_block: {
          select_id: 1,
          table: { table_name: "users", access_type: "ALL" },
        },
      };
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            EXPLAIN: JSON.stringify(mockPlan),
          },
        ]),
      );

      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { query: "SELECT * FROM users", format: "JSON" },
        mockContext,
      )) as { plan: unknown };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "EXPLAIN FORMAT=JSON SELECT * FROM users",
      );
      expect(result.plan).toEqual(mockPlan);
    });

    it("should fall back to raw rows if JSON parsing fails or not string", async () => {
      const mockRows = [{ EXPLAIN: null }];
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult(mockRows),
      );

      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { query: "SELECT * FROM users", format: "JSON" },
        mockContext,
      )) as { plan: unknown };

      expect(result.plan).toBe(mockRows);
    });

    it("should return exists false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      )) as { exists: boolean; error: string };

      expect(result.exists).toBe(false);
      expect(result.error).toContain("doesn't exist");
    });

    it("should return success false for invalid SQL", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("You have an error in your SQL syntax"),
      );

      const tool = createExplainTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { query: "SELECTT * FROMM users" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("SQL syntax");
    });
  });

  describe("createExplainAnalyzeTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createExplainAnalyzeTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_explain_analyze");
      expect(tool.group).toBe("performance");
      expect(tool.requiredScopes).toContain("read");
    });

    it("should run EXPLAIN ANALYZE", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            EXPLAIN:
              "-> Table scan on users  (actual time=0.05..0.10 rows=100 loops=1)",
          },
        ]),
      );

      const tool = createExplainAnalyzeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "EXPLAIN ANALYZE FORMAT=TREE SELECT * FROM users",
      );
      expect(result).toHaveProperty("analysis");
    });

    it("should return unsupported for JSON format", async () => {
      const tool = createExplainAnalyzeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT 1", format: "JSON" },
        mockContext,
      )) as { supported: boolean; reason: string };

      expect(result.supported).toBe(false);
      expect(result.reason).toContain("does not support FORMAT=JSON");
      // Should NOT call executeReadQuery for JSON format
      expect(mockAdapter.executeReadQuery).not.toHaveBeenCalled();
    });

    it("should return exists false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createExplainAnalyzeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      )) as { exists: boolean; error: string };

      expect(result.exists).toBe(false);
      expect(result.error).toContain("doesn't exist");
    });

    it("should return success false for invalid SQL", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("You have an error in your SQL syntax"),
      );

      const tool = createExplainAnalyzeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECTT * FROMM users" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("SQL syntax");
    });

    it("should accept sql alias for query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            EXPLAIN:
              "-> Table scan on users  (actual time=0.05..0.10 rows=100 loops=1)",
          },
        ]),
      );

      const tool = createExplainAnalyzeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { sql: "SELECT * FROM users" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "EXPLAIN ANALYZE FORMAT=TREE SELECT * FROM users",
      );
      expect(result).toHaveProperty("analysis");
    });
  });

  describe("createSlowQueriesTool", () => {
    it("should query performance_schema for slow queries", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            query: "SELECT * FROM big_table",
            executions: 5,
            avg_time_ms: 1000,
          },
        ]),
      );

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ limit: 5 }, mockContext);

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("LEFT(DIGEST_TEXT, 200)");
      expect(call).toContain("LIMIT 5");
      expect(result).toHaveProperty("slowQueries");
    });

    it("should filter by minTime", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ limit: 10, minTime: 0.5 }, mockContext);

      // 0.5 sec = 500,000,000,000 picoseconds (AVG_TIMER_WAIT is in picoseconds)
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("AVG_TIMER_WAIT > 500000000000");
    });

    it("should clamp overflowed timer values to -1 with overflow flag", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            query: "DROP TABLE IF EXISTS `t`",
            executions: 3,
            avg_time_ms: 18446743555252.1,
            total_time_ms: 55340230665756.3,
            rows_examined: 0,
            rows_sent: 0,
          },
        ]),
      );

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as {
        slowQueries: Record<string, unknown>[];
      };

      expect(result.slowQueries[0]["avg_time_ms"]).toBe(-1);
      expect(result.slowQueries[0]["total_time_ms"]).toBe(-1);
      expect(result.slowQueries[0]["overflow"]).toBe(true);
    });

    it("should clamp string-typed overflowed values (MySQL DECIMAL)", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            query: "DROP TABLE IF EXISTS `t`",
            executions: 2,
            avg_time_ms: "18446743555.2521",
            total_time_ms: "18446743036.7947",
            rows_examined: 0,
            rows_sent: 0,
          },
        ]),
      );

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as {
        slowQueries: Record<string, unknown>[];
      };

      expect(result.slowQueries[0]["avg_time_ms"]).toBe(-1);
      expect(result.slowQueries[0]["total_time_ms"]).toBe(-1);
      expect(result.slowQueries[0]["overflow"]).toBe(true);
    });

    it("should not add overflow flag for normal timer values", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            query: "SELECT 1",
            executions: 10,
            avg_time_ms: 500,
            total_time_ms: 5000,
            rows_examined: 0,
            rows_sent: 10,
          },
        ]),
      );

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as {
        slowQueries: Record<string, unknown>[];
      };

      expect(result.slowQueries[0]["avg_time_ms"]).toBe(500);
      expect(result.slowQueries[0]["total_time_ms"]).toBe(5000);
      expect(result.slowQueries[0]["overflow"]).toBeUndefined();
    });

    it("should convert string-typed timer values to numbers", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            query: "SELECT * FROM users",
            executions: 5,
            avg_time_ms: "209241.7573",
            total_time_ms: "1046208.7865",
            rows_examined: 100,
            rows_sent: 10,
          },
        ]),
      );

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as {
        slowQueries: Record<string, unknown>[];
      };

      expect(result.slowQueries[0]["avg_time_ms"]).toBe(209241.7573);
      expect(typeof result.slowQueries[0]["avg_time_ms"]).toBe("number");
      expect(result.slowQueries[0]["total_time_ms"]).toBe(1046208.7865);
      expect(typeof result.slowQueries[0]["total_time_ms"]).toBe("number");
      expect(result.slowQueries[0]["overflow"]).toBeUndefined();
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied for performance_schema"),
      );

      const tool = createSlowQueriesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 10 }, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  describe("createQueryStatsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      expect(tool.name).toBe("mysql_query_stats");
    });

    it("should order by total_time by default", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({}, mockContext);

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("ORDER BY SUM_TIMER_WAIT DESC");
      expect(call).toContain("LEFT(DIGEST_TEXT, 200)");
      expect(call).toContain("LIMIT 10");
    });

    it("should order by executions when requested", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ orderBy: "executions" }, mockContext);

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("ORDER BY COUNT_STAR DESC");
    });

    it("should order by avg_time when requested", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ orderBy: "avg_time" }, mockContext);

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("ORDER BY AVG_TIMER_WAIT DESC");
    });

    it("should clamp overflowed timer values to -1 with overflow flag", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            database_name: "testdb",
            query_text: "DROP TABLE IF EXISTS `t`",
            execution_count: 3,
            avg_time_ms: 18446743555252.1,
            max_time_ms: 99999999999,
            total_time_ms: 55340230665756.3,
            total_rows_examined: 0,
            total_rows_sent: 0,
            first_seen: "2026-01-01",
            last_seen: "2026-02-16",
          },
        ]),
      );

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        queries: Record<string, unknown>[];
      };

      expect(result.queries[0]["avg_time_ms"]).toBe(-1);
      expect(result.queries[0]["max_time_ms"]).toBe(-1);
      expect(result.queries[0]["total_time_ms"]).toBe(-1);
      expect(result.queries[0]["overflow"]).toBe(true);
    });

    it("should not add overflow flag for normal timer values", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            database_name: "testdb",
            query_text: "SELECT 1",
            execution_count: 10,
            avg_time_ms: 250,
            max_time_ms: 800,
            total_time_ms: 2500,
            total_rows_examined: 0,
            total_rows_sent: 10,
            first_seen: "2026-01-01",
            last_seen: "2026-02-16",
          },
        ]),
      );

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        queries: Record<string, unknown>[];
      };

      expect(result.queries[0]["avg_time_ms"]).toBe(250);
      expect(result.queries[0]["max_time_ms"]).toBe(800);
      expect(result.queries[0]["total_time_ms"]).toBe(2500);
      expect(result.queries[0]["overflow"]).toBeUndefined();
    });

    it("should convert string-typed timer values to numbers", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            database_name: "testdb",
            query_text: "SELECT * FROM users",
            execution_count: 5,
            avg_time_ms: "209241.7573",
            max_time_ms: "412000.5000",
            total_time_ms: "1046208.7865",
            total_rows_examined: 100,
            total_rows_sent: 10,
            first_seen: "2026-01-01",
            last_seen: "2026-02-16",
          },
        ]),
      );

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        queries: Record<string, unknown>[];
      };

      expect(result.queries[0]["avg_time_ms"]).toBe(209241.7573);
      expect(typeof result.queries[0]["avg_time_ms"]).toBe("number");
      expect(result.queries[0]["max_time_ms"]).toBe(412000.5);
      expect(typeof result.queries[0]["max_time_ms"]).toBe("number");
      expect(result.queries[0]["total_time_ms"]).toBe(1046208.7865);
      expect(typeof result.queries[0]["total_time_ms"]).toBe("number");
      expect(result.queries[0]["overflow"]).toBeUndefined();
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied for performance_schema"),
      );

      const tool = createQueryStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  describe("createIndexUsageTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      expect(tool.name).toBe("mysql_index_usage");
    });

    it("should query index usage stats", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("table_io_waits_summary_by_index_usage");
      expect(result).toHaveProperty("indexUsage");
    });

    it("should filter by table name", async () => {
      // First call: table existence check, second call: index usage query
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ "1": 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ table: "users" }, mockContext);

      // Second call should be the index usage query with table filter
      const call = mockAdapter.executeReadQuery.mock.calls[1][0] as string;
      expect(call).toContain("object_name = ?");
      const args = mockAdapter.executeReadQuery.mock.calls[1][1];
      expect(args).toEqual(["users"]);
    });

    it("should return exists: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({ table: "nonexistent" }, mockContext);

      expect(result).toEqual({ exists: false, table: "nonexistent" });
      // Should only call once (existence check), not the index usage query
      expect(mockAdapter.executeReadQuery).toHaveBeenCalledTimes(1);
    });

    it("should apply default limit", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({}, mockContext);

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIMIT 10");
    });

    it("should use custom limit", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ limit: 10 }, mockContext);

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIMIT 10");
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied for performance_schema"),
      );

      const tool = createIndexUsageTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  describe("createTableStatsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createTableStatsTool(mockAdapter as unknown as MySQLAdapter);
      expect(tool.name).toBe("mysql_table_stats");
    });

    it("should query table statistics", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            table_name: "users",
            estimated_rows: 1000,
          },
        ]),
      );

      const tool = createTableStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({ table: "users" }, mockContext)) as {
        stats: unknown;
      };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("information_schema.TABLES");
      expect(result.stats).toBeDefined();
    });

    it("should return exists false if table not found", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createTableStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { table: "nonexistent" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied for information_schema"),
      );

      const tool = createTableStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({ table: "users" }, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  describe("createBufferPoolStatsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createBufferPoolStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_buffer_pool_stats");
    });

    it("should query buffer pool stats", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            POOL_ID: 0,
            POOL_SIZE: 8192,
          },
        ]),
      );

      const tool = createBufferPoolStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("INNODB_BUFFER_POOL_STATS");
      expect(call).toContain("POOL_SIZE");
      expect(call).toContain("HIT_RATE");
      expect(call).not.toContain("SELECT *");
      expect(result).toHaveProperty("bufferPoolStats");
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied for information_schema"),
      );

      const tool = createBufferPoolStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });

  describe("createThreadStatsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createThreadStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_thread_stats");
    });

    it("should query thread stats", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            THREAD_ID: 1,
            NAME: "thread/sql/one_connection",
          },
        ]),
      );

      const tool = createThreadStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("performance_schema.threads");
      expect(result).toHaveProperty("threads");
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied for performance_schema"),
      );

      const tool = createThreadStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Access denied");
    });
  });
});

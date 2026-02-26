/**
 * mysql-mcp - Optimization Trace Summary & Error Path Tests
 *
 * Tests for extractTraceSummary (via optimizer_trace summary=true)
 * and error paths in optimization tools.
 * Targets lines 40-157, 308, 314, 321, 487 in optimization.ts.
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
} from "../../../../../__tests__/mocks/index.js";

describe("Optimization Tools — Summary & Error Paths", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  // ===========================================================================
  // extractTraceSummary (via optimizer trace with summary=true)
  // ===========================================================================
  describe("optimizer trace summary mode", () => {
    it("should return error when no trace data", async () => {
      // Enable tracing
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      // Execute query
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // user query
        .mockResolvedValueOnce(createMockQueryResult([])); // OPTIMIZER_TRACE empty

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT 1", summary: true },
        mockContext,
      )) as { error?: string; decisions?: unknown[] };

      expect(result.error).toContain("No trace data");
    });

    it("should extract index selection decisions from trace", async () => {
      const traceJson = JSON.stringify({
        steps: [
          {
            join_optimization: {
              steps: [
                {
                  rows_estimation: [
                    {
                      table: "users",
                      range_analysis: {
                        chosen_range_access_summary: {
                          chosen: true,
                          range_access_plan: {
                            type: "range",
                            index: "idx_email",
                            rows: 10,
                          },
                          cost_for_plan: 5.5,
                        },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([])) // user query
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: traceJson }]));

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users WHERE email = 'test'", summary: true },
        mockContext,
      )) as { decisions: { type: string; index?: string }[] };

      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].type).toBe("index_selection");
      expect(result.decisions[0].index).toBe("idx_email");
    });

    it("should extract table scan decisions", async () => {
      const traceJson = JSON.stringify({
        steps: [
          {
            join_optimization: {
              steps: [
                {
                  rows_estimation: [
                    {
                      table: "orders",
                      range_analysis: {
                        table_scan: { rows: 1000, cost: 200 },
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: traceJson }]));

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM orders", summary: true },
        mockContext,
      )) as { decisions: { type: string; table?: string }[] };

      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].type).toBe("table_scan");
      expect(result.decisions[0].table).toBe("orders");
    });

    it("should extract access path decisions", async () => {
      const traceJson = JSON.stringify({
        steps: [
          {
            join_optimization: {
              steps: [
                {
                  considered_execution_plans: [
                    {
                      table: "products",
                      best_access_path: {
                        considered_access_paths: [
                          {
                            access_type: "ref",
                            index: "idx_category",
                            rows: 50,
                            cost: 10.5,
                            chosen: true,
                          },
                          {
                            access_type: "full_scan",
                            rows: 1000,
                            cost: 200,
                            chosen: false,
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        ],
      });

      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: traceJson }]));

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          query: "SELECT * FROM products WHERE category_id = 1",
          summary: true,
        },
        mockContext,
      )) as { decisions: { type: string; accessType?: string }[] };

      expect(result.decisions).toHaveLength(1);
      expect(result.decisions[0].type).toBe("access_path");
      expect(result.decisions[0].accessType).toBe("ref");
    });

    it("should handle invalid trace JSON", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(
          createMockQueryResult([{ TRACE: "not valid json {{{" }]),
        );

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT 1", summary: true },
        mockContext,
      )) as { error?: string };

      expect(result.error).toContain("Failed to parse trace");
    });

    it("should handle TRACE column with non-string value", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([]))
        .mockResolvedValueOnce(createMockQueryResult([{ TRACE: 12345 }]));

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT 1", summary: true },
        mockContext,
      )) as { error?: string };

      expect(result.error).toContain("Invalid trace format");
    });

    it("should handle query execution failure in trace mode", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery.mockRejectedValueOnce(
        new Error("Table 'nonexistent' doesn't exist"),
      );

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent", summary: true },
        mockContext,
      )) as { error?: string; decisions?: unknown[] };

      expect(result.error).toContain("doesn't exist");
      expect(result.decisions).toEqual([]);
    });

    it("should handle query execution failure in non-summary mode", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      mockAdapter.executeReadQuery.mockRejectedValueOnce(
        new Error("Query failed: Table error"),
      );

      const tool = createOptimizerTraceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      )) as { error?: string; trace?: unknown };

      expect(result.error).toBeDefined();
      expect(result.trace).toBeNull();
    });
  });

  // ===========================================================================
  // Query Rewrite edge cases
  // ===========================================================================
  describe("query rewrite edge cases", () => {
    it("should detect OR in WHERE clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users WHERE id = 1 OR name = 'test'" },
        mockContext,
      )) as { suggestions: string[] };

      expect(
        result.suggestions.some((s: string) => s.includes("OR conditions")),
      ).toBe(true);
    });

    it("should detect NOT IN pattern", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users WHERE id NOT IN (1,2,3)" },
        mockContext,
      )) as { suggestions: string[] };

      expect(result.suggestions.some((s: string) => s.includes("NOT IN"))).toBe(
        true,
      );
    });

    it("should detect ORDER BY without LIMIT", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT id FROM users ORDER BY name" },
        mockContext,
      )) as { suggestions: string[] };

      expect(
        result.suggestions.some((s: string) =>
          s.includes("ORDER BY without LIMIT"),
        ),
      ).toBe(true);
    });

    it("should detect leading wildcard in LIKE", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM users WHERE name LIKE '%test'" },
        mockContext,
      )) as { suggestions: string[] };

      expect(
        result.suggestions.some((s: string) => s.includes("Leading wildcard")),
      ).toBe(true);
    });

    it("should handle EXPLAIN returning JSON", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { EXPLAIN: '{"query_block": {"select_id": 1}}' },
        ]),
      );

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT 1 FROM dual LIMIT 1" },
        mockContext,
      )) as { explainPlan: unknown };

      expect(result.explainPlan).toBeDefined();
    });

    it("should handle EXPLAIN failure gracefully", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Query failed: Unknown table"),
      );

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { query: "SELECT * FROM nonexistent LIMIT 1" },
        mockContext,
      )) as { explainError: string; explainPlan: unknown };

      expect(result.explainError).toBeDefined();
      expect(result.explainPlan).toBeNull();
    });

    it("should use sql alias for query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { sql: "SELECT 1 FROM dual LIMIT 1" },
        mockContext,
      )) as { originalQuery: string };

      expect(result.originalQuery).toBe("SELECT 1 FROM dual LIMIT 1");
    });

    it("should return error when no query provided", async () => {
      const tool = createQueryRewriteTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
    });
  });

  // ===========================================================================
  // Index Recommendation edge cases
  // ===========================================================================
  describe("index recommendation edge cases", () => {
    it("should suggest indexes for timestamp columns", async () => {
      mockAdapter.describeTable.mockResolvedValue({
        columns: [
          { name: "id", type: "int", nullable: false },
          { name: "created_at", type: "datetime", nullable: true },
        ],
      });
      mockAdapter.getTableIndexes.mockResolvedValue([
        { name: "PRIMARY", columns: ["id"], unique: true },
      ]);

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ table: "users" }, mockContext)) as {
        recommendations: { column: string; reason: string }[];
      };

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].column).toBe("created_at");
      expect(result.recommendations[0].reason).toContain("Timestamp");
    });

    it("should suggest indexes for status columns", async () => {
      mockAdapter.describeTable.mockResolvedValue({
        columns: [
          { name: "id", type: "int", nullable: false },
          { name: "status", type: "varchar", nullable: true },
        ],
      });
      mockAdapter.getTableIndexes.mockResolvedValue([
        { name: "PRIMARY", columns: ["id"], unique: true },
      ]);

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ table: "orders" }, mockContext)) as {
        recommendations: { column: string; reason: string }[];
      };

      const statusRec = result.recommendations.find(
        (r) => r.column === "status",
      );
      expect(statusRec).toBeDefined();
      expect(statusRec!.reason).toContain("Status/type");
    });

    it("should handle nonexistent table", async () => {
      mockAdapter.describeTable.mockResolvedValue({ columns: [] });

      const tool = createIndexRecommendationTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent" },
        mockContext,
      )) as { exists: boolean };

      expect(result.exists).toBe(false);
    });
  });

  // ===========================================================================
  // Force Index edge cases
  // ===========================================================================
  describe("force index edge cases", () => {
    it("should warn when index doesn't exist", async () => {
      mockAdapter.describeTable.mockResolvedValue({
        columns: [{ name: "id", type: "int", nullable: false }],
      });
      mockAdapter.getTableIndexes.mockResolvedValue([
        { name: "PRIMARY", columns: ["id"], unique: true },
      ]);

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          query: "SELECT * FROM users WHERE id = 1",
          indexName: "nonexistent_idx",
        },
        mockContext,
      )) as { warning?: string; rewrittenQuery: string };

      expect(result.warning).toContain("not found");
      expect(result.rewrittenQuery).toContain("FORCE INDEX");
    });

    it("should handle nonexistent table in force index", async () => {
      mockAdapter.describeTable.mockResolvedValue({ columns: [] });

      const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "nonexistent",
          query: "SELECT * FROM nonexistent",
          indexName: "idx1",
        },
        mockContext,
      )) as { exists: boolean };

      expect(result.exists).toBe(false);
    });
  });
});

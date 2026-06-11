import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createStatsRowNumberTool,
  createStatsRankTool,
  createStatsLagLeadTool,
  createStatsRunningTotalTool,
  createStatsMovingAvgTool,
  createStatsNtileTool,
} from "../window.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Window Function Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();

    mockAdapter.executeQuery.mockImplementation(async () => {
      return createMockQueryResult([
        {
          id: 1,
          value: 10,
          row_number: 1,
          rank: 1,
          dense_rank: 1,
          lag_value: null,
          running_total: 10,
          moving_avg: 10,
          ntile: 1,
        },
      ]);
    });
  });

  describe("Row Number Tool", () => {
    let tool: ReturnType<typeof createStatsRowNumberTool>;

    beforeEach(() => {
      tool = createStatsRowNumberTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should assign row numbers", async () => {
      const result = await tool.handler(
        { table: "users", orderBy: "score DESC" },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain("ROW_NUMBER() OVER( ORDER BY `score DESC`)");
    });

    it("should return error on invalid table name", async () => {
      const result = await tool.handler(
        { table: "users;", orderBy: "score DESC" },
        mockContext,
      );
      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain("Invalid table name");
    });

    it("should handle Zod validation errors", async () => {
      const result = await tool.handler(
        { table: "users" }, // Missing orderBy
        mockContext,
      );
      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain("Validation error");
    });

    it("should handle table not found error", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Table 'unknown' doesn't exist"),
      );
      const result = await tool.handler(
        { table: "unknown", orderBy: "score DESC" },
        mockContext,
      );
      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain("doesn't exist");
    });
  });

  describe("Rank Tool", () => {
    let tool: ReturnType<typeof createStatsRankTool>;

    beforeEach(() => {
      tool = createStatsRankTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should assign ranks", async () => {
      const result = await tool.handler(
        { table: "users", orderBy: "score DESC", method: "dense_rank" },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain("DENSE_RANK() OVER( ORDER BY `score DESC`)");
    });
  });

  describe("Lag/Lead Tool", () => {
    let tool: ReturnType<typeof createStatsLagLeadTool>;

    beforeEach(() => {
      tool = createStatsLagLeadTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should use LAG", async () => {
      const result = await tool.handler(
        {
          table: "sales",
          column: "amount",
          orderBy: "date",
          direction: "lag",
          offset: 2,
        },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain("LAG(`amount`, 2) OVER( ORDER BY `date`)");
    });

    it("should return error on invalid column name", async () => {
      const result = await tool.handler(
        {
          table: "sales",
          column: "amount;",
          orderBy: "date",
          direction: "lag",
        },
        mockContext,
      );
      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain("Invalid column name");
    });

    it("should handle unknown column error", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Unknown column 'missing_col'"),
      );
      const result = await tool.handler(
        {
          table: "sales",
          column: "missing_col",
          orderBy: "date",
          direction: "lag",
        },
        mockContext,
      );
      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain(
        "One or more referenced columns do not exist",
      );
    });
  });

  describe("Running Total Tool", () => {
    let tool: ReturnType<typeof createStatsRunningTotalTool>;

    beforeEach(() => {
      tool = createStatsRunningTotalTool(
        mockAdapter as unknown as MySQLAdapter,
      );
    });

    it("should calculate running total", async () => {
      const result = await tool.handler(
        { table: "sales", column: "amount", orderBy: "date" },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain(
        "SUM(`amount`) OVER( ORDER BY `date` ROWS UNBOUNDED PRECEDING)",
      );
    });
  });

  describe("Moving Avg Tool", () => {
    let tool: ReturnType<typeof createStatsMovingAvgTool>;

    beforeEach(() => {
      tool = createStatsMovingAvgTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should calculate moving average", async () => {
      const result = await tool.handler(
        { table: "sales", column: "amount", orderBy: "date", windowSize: 3 },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain(
        "AVG(`amount`) OVER( ORDER BY `date` ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)",
      );
    });
  });

  describe("Ntile Tool", () => {
    let tool: ReturnType<typeof createStatsNtileTool>;

    beforeEach(() => {
      tool = createStatsNtileTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should assign ntile buckets", async () => {
      const result = await tool.handler(
        { table: "users", orderBy: "score DESC", buckets: 4 },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sql).toContain("NTILE(4) OVER( ORDER BY `score DESC`)");
    });
  });
});

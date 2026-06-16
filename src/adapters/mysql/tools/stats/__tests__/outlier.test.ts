import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStatsOutliersTool } from "../outlier.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Outliers Tool", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createStatsOutliersTool", () => {
    let tool: ReturnType<typeof createStatsOutliersTool>;

    beforeEach(() => {
      tool = createStatsOutliersTool(mockAdapter);
    });

    it("should detect outliers using Z-score", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("AVG")) {
          return createMockQueryResult([
            { mean: 10, stddev: 2, total_count: 100 },
          ]);
        }
        if (query.includes("ABS")) {
          // Mock finding 1 outlier
          return createMockQueryResult([{ value: 20 }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "data", column: "val", method: "zscore", threshold: 3 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.method).toBe("zscore");
      expect(data.outliers.length).toBe(1);
      expect(data.outliers[0].value).toBe(20);
      expect(data.stats.lowerBound).toBe(4);
      expect(data.stats.upperBound).toBe(16);
    });

    it("should handle z-score with zero stddev", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("AVG")) {
          return createMockQueryResult([
            { mean: 10, stddev: 0, total_count: 100 },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "data", column: "val", method: "zscore", threshold: 3 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      expect(Reflect.get(result || {}, "data").outlierCount).toBe(0);
    });

    it("should detect outliers using IQR", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("COUNT(")) {
          return createMockQueryResult([{ total_count: 100 }]);
        }
        if (query.includes("LIMIT 1 OFFSET")) {
          // Return q1 and q3 sequentially if mock doesn't inspect offset,
          // but we can just use a simple state to return different values
          if (query.includes("OFFSET 24"))
            return createMockQueryResult([{ value: 10 }]); // Q1
          if (query.includes("OFFSET 74"))
            return createMockQueryResult([{ value: 20 }]); // Q3
          return createMockQueryResult([{ value: 15 }]);
        }
        if (query.includes("OR")) {
          // Outlier results
          return createMockQueryResult([{ value: 40 }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "data", column: "val", method: "iqr", threshold: 1.5 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.method).toBe("iqr");
      expect(data.stats.q1).toBe(10);
      expect(data.stats.q3).toBe(20);
      expect(data.stats.iqr).toBe(10);
      expect(data.stats.lowerBound).toBe(-5);
      expect(data.stats.upperBound).toBe(35);
      expect(data.outliers.length).toBe(1);
      expect(data.outliers[0].value).toBe(40);
    });

    it("should handle empty tables for IQR", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("COUNT(")) {
          return createMockQueryResult([{ total_count: 0 }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "data", column: "val", method: "iqr" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      expect(Reflect.get(result || {}, "data").totalCount).toBe(0);
      expect(Reflect.get(result || {}, "data").outlierCount).toBe(0);
    });
  });
});

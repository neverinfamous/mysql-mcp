import { describe, it, expect, vi, beforeEach } from "vitest";
import { createStatsHypothesisTool } from "../hypothesis.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Hypothesis Tool", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createStatsHypothesisTool", () => {
    let tool: ReturnType<typeof createStatsHypothesisTool>;

    beforeEach(() => {
      tool = createStatsHypothesisTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should perform t-test", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([{ n: 100, mean: 5.5, stddev: 2.0 }]);
      });

      const result = await tool.handler(
        {
          table: "data",
          column: "val",
          testType: "t_test",
          hypothesizedMean: 5.0,
        },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.testType).toBe("t_test");
      expect(data.results.sampleSize).toBe(100);
      expect(data.results.testStatistic).toBeCloseTo(2.5, 1);
      expect(data.results.degreesOfFreedom).toBe(99);
      expect(data.results.pValue).toBeLessThan(0.05);
    });

    it("should perform z-test with population stddev", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([{ n: 100, mean: 5.5, stddev: 2.0 }]);
      });

      const result = await tool.handler(
        {
          table: "data",
          column: "val",
          testType: "z_test",
          hypothesizedMean: 5.0,
          populationStdDev: 1.5,
        },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.testType).toBe("z_test");
      expect(data.results.populationStdDev).toBe(1.5);
      expect(data.results.testStatistic).toBeCloseTo(3.33, 1); // (5.5 - 5.0) / (1.5 / 10)
      expect(data.results.degreesOfFreedom).toBeNull();
    });

    it("should handle grouped hypothesis tests", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([
          { group_key: "A", n: 50, mean: 6.0, stddev: 1.5 },
          { group_key: "B", n: 50, mean: 5.2, stddev: 1.5 },
        ]);
      });

      const result = await tool.handler(
        {
          table: "data",
          column: "val",
          testType: "t_test",
          hypothesizedMean: 5.0,
          groupBy: "category",
        },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.count).toBe(2);
      expect(data.groups[0].groupKey).toBe("A");
      expect(data.groups[0].results.sampleMean).toBe(6.0);
      expect(data.groups[1].groupKey).toBe("B");
      expect(data.groups[1].results.sampleMean).toBe(5.2);
    });

    it("should handle insufficient data", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([{ n: 1, mean: 5.5, stddev: 0 }]);
      });

      const result = await tool.handler(
        {
          table: "data",
          column: "val",
          testType: "t_test",
          hypothesizedMean: 5.0,
        },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("Insufficient data");
    });
  });
});

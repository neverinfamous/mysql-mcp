import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDescriptiveStatsTool,
  createPercentilesTool,
  createDistributionTool,
  createTimeSeriesToolStats,
  createSamplingTool,
} from "../descriptive/index.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Descriptive Stats Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("Descriptive Stats Tool", () => {
    let tool: ReturnType<typeof createDescriptiveStatsTool>;

    beforeEach(() => {
      tool = createDescriptiveStatsTool(mockAdapter);
    });

    it("should calculate descriptive stats", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("DATA_TYPE")) {
          return createMockQueryResult([{ DATA_TYPE: "int" }]);
        }
        if (query.includes("COUNT(*)")) {
          return createMockQueryResult([{ count: 10 }]);
        }
        if (query.includes("median")) {
          return createMockQueryResult([{ median: 5.5 }]);
        }
        if (query.includes("mean")) {
          return createMockQueryResult([
            {
              count: 10,
              mean: 5.5,
              stddev: 2.8,
              variance: 8.2,
              min: 1,
              max: 10,
              range: 9,
              sum: 55,
            },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "age" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.count).toBe(10);
      expect(data.mean).toBe(5.5);
      expect(data.median).toBe(5.5);
      expect(data.stddev).toBe(2.8);
      expect(data.variance).toBe(8.2);
    });

    it("should handle empty tables gracefully", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("DATA_TYPE")) {
          return createMockQueryResult([{ DATA_TYPE: "int" }]);
        }
        if (query.includes("COUNT(*)")) {
          return createMockQueryResult([{ count: 0 }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "age" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.count).toBe(0);
      expect(data.mean).toBeNull();
      expect(data.median).toBeNull();
    });

    it("should reject invalid table names", async () => {
      const result = await tool.handler(
        { table: "invalid table", column: "age" },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("Invalid table name");
    });
  });

  describe("Percentiles Tool", () => {
    let tool: ReturnType<typeof createPercentilesTool>;

    beforeEach(() => {
      tool = createPercentilesTool(mockAdapter);
    });

    it("should calculate percentiles", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("DATA_TYPE")) {
          return createMockQueryResult([{ DATA_TYPE: "int" }]);
        }
        if (query.includes("COUNT(*)")) {
          return createMockQueryResult([{ cnt: 100 }]);
        }
        if (query.includes("LIMIT 1 OFFSET")) {
          return createMockQueryResult([{ value: 42 }]); // Just mock same value for all for simplicity
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "age", percentiles: [50, 90] },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.totalCount).toBe(100);
      expect(data.percentiles.p50).toBe(42);
      expect(data.percentiles.p90).toBe(42);
    });

    it("should reject non-numeric columns", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("DATA_TYPE")) {
          return createMockQueryResult([{ DATA_TYPE: "varchar" }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "name" },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("is not a numeric column");
    });
  });

  describe("Distribution Tool", () => {
    let tool: ReturnType<typeof createDistributionTool>;

    beforeEach(() => {
      tool = createDistributionTool(mockAdapter);
    });

    it("should calculate distribution buckets", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        if (query.includes("DATA_TYPE")) {
          return createMockQueryResult([{ DATA_TYPE: "int" }]);
        }
        if (query.includes("GROUP BY bucket")) {
          return createMockQueryResult([
            { bucket: 0, count: 50, bucket_min: 0, bucket_max: 9 },
            { bucket: 9, count: 50, bucket_min: 90, bucket_max: 100 },
          ]);
        }
        if (query.includes("MIN(")) {
          return createMockQueryResult([{ min_val: 0, max_val: 100 }]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { table: "users", column: "score", buckets: 10 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.bucketCount).toBe(10);
      expect(data.minValue).toBe(0);
      expect(data.maxValue).toBe(100);
      expect(data.distribution.length).toBe(2);
      expect(data.distribution[0].bucket).toBe(0);
      expect(data.distribution[0].count).toBe(50);
    });
  });

  describe("Time Series Tool", () => {
    let tool: ReturnType<typeof createTimeSeriesToolStats>;

    beforeEach(() => {
      tool = createTimeSeriesToolStats(mockAdapter);
    });

    it("should aggregate time series data", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([
          {
            period: "2024-01-01",
            value: 100,
            data_points: 10,
            period_min: 5,
            period_max: 15,
          },
        ]);
      });

      const result = await tool.handler(
        {
          table: "sales",
          valueColumn: "amount",
          timeColumn: "created_at",
          interval: "day",
          aggregation: "sum",
        },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.interval).toBe("day");
      expect(data.aggregation).toBe("sum");
      expect(data.dataPoints.length).toBe(1);
      expect(data.dataPoints[0].period).toBe("2024-01-01");
      expect(data.dataPoints[0].value).toBe(100);
    });

    it("should reject invalid intervals", async () => {
      const result = await tool.handler(
        {
          table: "sales",
          valueColumn: "amount",
          timeColumn: "created_at",
          interval: "invalid",
        },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("Invalid interval");
    });
  });

  describe("Sampling Tool", () => {
    let tool: ReturnType<typeof createSamplingTool>;

    beforeEach(() => {
      tool = createSamplingTool(mockAdapter);
    });

    it("should return random sample", async () => {
      mockAdapter.executeQuery.mockImplementation(async () => {
        return createMockQueryResult([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]);
      });

      const result = await tool.handler(
        { table: "users", sampleSize: 2 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.sampleSize).toBe(2);
      expect(data.sample.length).toBe(2);
      expect(data.sample[0].name).toBe("Alice");
    });

    it("should handle specific columns and seed", async () => {
      mockAdapter.executeQuery.mockImplementation(async (query: string) => {
        expect(query).toContain("`name`");
        expect(query).toContain("RAND(123)");
        return createMockQueryResult([{ name: "Alice" }]);
      });

      const result = await tool.handler(
        { table: "users", sampleSize: 1, columns: ["name"], seed: 123 },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
    });
  });
});

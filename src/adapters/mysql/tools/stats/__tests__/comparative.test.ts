import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCorrelationTool,
  createRegressionTool,
  createHistogramTool,
} from "../comparative/index.js";

describe("Comparative Stats Tools", () => {
  let mockAdapter: MySQLAdapter;
  let correlationTool: ToolDefinition;
  let regressionTool: ToolDefinition;
  let histogramTool: ToolDefinition;

  beforeEach(() => {
    mockAdapter = {
      executeQuery: vi.fn(),
    };
    correlationTool = createCorrelationTool(mockAdapter as MySQLAdapter);
    regressionTool = createRegressionTool(mockAdapter as MySQLAdapter);
    histogramTool = createHistogramTool(mockAdapter as MySQLAdapter);
  });

  describe("mysql_stats_correlation", () => {
    it("should interpret strong correlation", async () => {
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: unknown[]) => {
          if (
            typeof query === "string" &&
            query.includes("information_schema.COLUMNS")
          ) {
            const col1 = params?.[1] || "x";
            const col2 = params?.[2] || "y";
            return {
              rows: [
                { COLUMN_NAME: col1, DATA_TYPE: "int" },
                { COLUMN_NAME: col2, DATA_TYPE: "int" },
              ],
            };
          }
          return {
            rows: [
              {
                correlation: 0.95,
                sample_size: 100,
                mean_x: 10,
                mean_y: 20,
                std_x: 2,
                std_y: 3,
              },
            ],
          };
        },
      );

      const result = await correlationTool.handler(
        {
          table: "data",
          column1: "x",
          column2: "y",
        },
        {},
      );

      expect(result.data.correlation).toBe(0.95);
      expect(result.data.interpretation).toBe("Very strong");
    });

    it("should interpret weak correlation", async () => {
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: unknown[]) => {
          if (
            typeof query === "string" &&
            query.includes("information_schema.COLUMNS")
          ) {
            const col1 = params?.[1] || "x";
            const col2 = params?.[2] || "y";
            return {
              rows: [
                { COLUMN_NAME: col1, DATA_TYPE: "int" },
                { COLUMN_NAME: col2, DATA_TYPE: "int" },
              ],
            };
          }
          return {
            rows: [{ correlation: 0.2, sample_size: 100 }],
          };
        },
      );

      const result = await correlationTool.handler(
        {
          table: "data",
          column1: "x",
          column2: "y",
        },
        {},
      );

      expect(result.data.interpretation).toBe("Very weak / No correlation");
    });

    it("should validate inputs", async () => {
      const result = await correlationTool.handler(
        {
          table: "bad;table",
          column1: "x",
          column2: "y",
        },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });
  });

  describe("mysql_stats_regression", () => {
    it("should handle insufficient data", async () => {
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: unknown[]) => {
          if (
            typeof query === "string" &&
            query.includes("information_schema.COLUMNS")
          ) {
            const col1 = params?.[1] || "x";
            const col2 = params?.[2] || "y";
            return {
              rows: [
                { COLUMN_NAME: col1, DATA_TYPE: "int" },
                { COLUMN_NAME: col2, DATA_TYPE: "int" },
              ],
            };
          }
          return {
            rows: [{ n: 1 }],
          };
        },
      );

      const result = await regressionTool.handler(
        {
          table: "data",
          xColumn: "x",
          yColumn: "y",
        },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient data");
    });

    it("should calculate regression and interpretation", async () => {
      // Need n, sum_x, sum_y, sum_xy, sum_x2, sum_y2 to calculate slope/intercept/r2
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: unknown[]) => {
          if (
            typeof query === "string" &&
            query.includes("information_schema.COLUMNS")
          ) {
            const col1 = params?.[1] || "x";
            const col2 = params?.[2] || "y";
            return {
              rows: [
                { COLUMN_NAME: col1, DATA_TYPE: "int" },
                { COLUMN_NAME: col2, DATA_TYPE: "int" },
              ],
            };
          }
          return {
            rows: [
              {
                n: 3,
                sum_x: 6,
                sum_y: 6,
                sum_xy: 14,
                sum_x2: 14,
                sum_y2: 14,
                avg_x: 2,
                avg_y: 2,
              },
            ],
          };
        },
      );

      const result = await regressionTool.handler(
        {
          table: "data",
          xColumn: "x",
          yColumn: "y",
        },
        {},
      );

      expect(result.data.slope).toBeCloseTo(1);
      expect(result.data.intercept).toBeCloseTo(0);
      expect(result.data.rSquared).toBeCloseTo(1);
      expect(result.data.interpretation).toBe("Good fit");
    });
  });

  describe("mysql_stats_histogram", () => {
    it("should handle update", async () => {
      // First call: table/column check, second: ANALYZE TABLE, third: histogram query
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [] }) // table/column check
        .mockResolvedValueOnce({}) // analyze table
        .mockResolvedValueOnce({ rows: [{ histogramType: "SINGLETON" }] }); // select info

      const result = await histogramTool.handler(
        {
          table: "users",
          column: "age",
          update: true,
        },
        {},
      );

      const calls = mockAdapter.executeQuery.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(calls.some((c: string) => c.includes("ANALYZE TABLE"))).toBe(true);
      expect(result.data.exists).toBe(true);
    });

    it("should handle non-existent histogram", async () => {
      // First call: table/column check, second: no histogram found
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [] }) // table/column check
        .mockResolvedValueOnce({ rows: [] }); // histogram query

      const result = await histogramTool.handler(
        {
          table: "users",
          column: "age",
        },
        {},
      );

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });

    it("should handle non-existent column", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("Unknown column 'nonexistent_col' in 'field list'"));

      const result = await histogramTool.handler(
        {
          table: "users",
          column: "nonexistent_col",
        },
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Column 'nonexistent_col' not found");
    });
  });
});

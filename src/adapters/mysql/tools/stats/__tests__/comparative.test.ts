import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCorrelationTool,
  createRegressionTool,
  createHistogramTool,
} from "../comparative/index.js";
import { MySQLAdapter } from "../../../mysql-adapter/index.js";

describe("Comparative Stats Tools", () => {
  let mockAdapter: any;
  let correlationTool: any;
  let regressionTool: any;
  let histogramTool: any;

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
        async (query: string, params?: any[]) => {
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

      const result: any = await correlationTool.handler(
        {
          table: "data",
          column1: "x",
          column2: "y",
        },
        {} as any,
      );

      expect(result.data.correlation).toBe(0.95);
      expect(result.data.interpretation).toBe("Very strong");
    });

    it("should interpret weak correlation", async () => {
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: any[]) => {
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

      const result: any = await correlationTool.handler(
        {
          table: "data",
          column1: "x",
          column2: "y",
        },
        {} as any,
      );

      expect(result.data.interpretation).toBe("Very weak / No correlation");
    });

    it("should validate inputs", async () => {
      const result: any = await correlationTool.handler(
        {
          table: "bad;table",
          column1: "x",
          column2: "y",
        },
        {} as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });
  });

  describe("mysql_stats_regression", () => {
    it("should handle insufficient data", async () => {
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: any[]) => {
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

      const result: any = await regressionTool.handler(
        {
          table: "data",
          xColumn: "x",
          yColumn: "y",
        },
        {} as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient data");
    });

    it("should calculate regression and interpretation", async () => {
      // Need n, sum_x, sum_y, sum_xy, sum_x2, sum_y2 to calculate slope/intercept/r2
      mockAdapter.executeQuery.mockImplementation(
        async (query: string, params?: any[]) => {
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

      const result: any = await regressionTool.handler(
        {
          table: "data",
          xColumn: "x",
          yColumn: "y",
        },
        {} as any,
      );

      expect(result.data.slope).toBeCloseTo(1);
      expect(result.data.intercept).toBeCloseTo(0);
      expect(result.data.rSquared).toBeCloseTo(1);
      expect(result.data.interpretation).toBe("Good fit");
    });
  });

  describe("mysql_stats_histogram", () => {
    it("should handle update", async () => {
      // First call: table existence check, second: column check, third: ANALYZE TABLE, fourth: histogram query
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ TABLE_NAME: "users" }] }) // table check
        .mockResolvedValueOnce({ rows: [{ COLUMN_NAME: "age" }] }) // column check
        .mockResolvedValueOnce({}) // analyze table
        .mockResolvedValueOnce({ rows: [{ histogramType: "SINGLETON" }] }); // select info

      const result: any = await histogramTool.handler(
        {
          table: "users",
          column: "age",
          update: true,
        },
        {} as any,
      );

      const calls = mockAdapter.executeQuery.mock.calls.map(
        (c: any[]) => c[0] as string,
      );
      expect(calls.some((c: string) => c.includes("ANALYZE TABLE"))).toBe(true);
      expect(result.data.exists).toBe(true);
    });

    it("should handle non-existent histogram", async () => {
      // First call: table exists, second: column exists, third: no histogram found
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ TABLE_NAME: "users" }] }) // table check
        .mockResolvedValueOnce({ rows: [{ COLUMN_NAME: "age" }] }) // column check
        .mockResolvedValueOnce({ rows: [] }); // histogram query

      const result: any = await histogramTool.handler(
        {
          table: "users",
          column: "age",
        },
        {} as any,
      );

      expect(result.success).toBe(true);
      expect(result.data.exists).toBe(false);
    });

    it("should handle non-existent column", async () => {
      // First call: table exists, second: column does not exist
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ TABLE_NAME: "users" }] }) // table check
        .mockResolvedValueOnce({ rows: [] }); // column check - not found

      const result: any = await histogramTool.handler(
        {
          table: "users",
          column: "nonexistent_col",
        },
        {} as any,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist on table");
      expect(result.error).toContain("nonexistent_col");
    });
  });
});

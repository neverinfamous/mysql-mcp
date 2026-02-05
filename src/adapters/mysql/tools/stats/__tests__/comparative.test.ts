import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createCorrelationTool,
  createRegressionTool,
  createHistogramTool,
} from "../comparative.js";
import { MySQLAdapter } from "../../../MySQLAdapter.js";

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
      mockAdapter.executeQuery.mockResolvedValue({
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
      });

      const result: any = await correlationTool.handler(
        {
          table: "data",
          column1: "x",
          column2: "y",
        },
        {} as any,
      );

      expect(result.correlation).toBe(0.95);
      expect(result.interpretation).toBe("Very strong");
    });

    it("should interpret weak correlation", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [{ correlation: 0.2, sample_size: 100 }],
      });

      const result: any = await correlationTool.handler(
        {
          table: "data",
          column1: "x",
          column2: "y",
        },
        {} as any,
      );

      expect(result.interpretation).toBe("Very weak / No correlation");
    });

    it("should validate inputs", async () => {
      await expect(
        correlationTool.handler(
          {
            table: "bad;table",
            column1: "x",
            column2: "y",
          },
          {} as any,
        ),
      ).rejects.toThrow("Invalid table name");
    });
  });

  describe("mysql_stats_regression", () => {
    it("should handle insufficient data", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [{ n: 1 }],
      });

      const result: any = await regressionTool.handler(
        {
          table: "data",
          xColumn: "x",
          yColumn: "y",
        },
        {} as any,
      );

      expect(result.error).toContain("Insufficient data");
    });

    it("should calculate regression and interpretation", async () => {
      // Need n, sum_x, sum_y, sum_xy, sum_x2, sum_y2 to calculate slope/intercept/r2
      mockAdapter.executeQuery.mockResolvedValue({
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
      });

      const result: any = await regressionTool.handler(
        {
          table: "data",
          xColumn: "x",
          yColumn: "y",
        },
        {} as any,
      );

      expect(result.slope).toBeCloseTo(1);
      expect(result.intercept).toBeCloseTo(0);
      expect(result.rSquared).toBeCloseTo(1);
      expect(result.interpretation).toBe("Good fit");
    });
  });

  describe("mysql_stats_histogram", () => {
    it("should handle update", async () => {
      // First call (UPDATE) returns whatever, second call (SELECT) returns info
      mockAdapter.executeQuery
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

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("ANALYZE TABLE"),
      );
      expect(result.exists).toBe(true);
    });

    it("should handle non-existent histogram", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [] });

      const result: any = await histogramTool.handler(
        {
          table: "users",
          column: "age",
        },
        {} as any,
      );

      expect(result.exists).toBe(false);
      expect(result.message).toContain("No histogram exists");
    });
  });
});

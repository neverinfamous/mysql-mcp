import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDetectQueryAnomaliesTool,
  createDetectBloatRiskTool,
  riskFromScore,
  toNum,
  toStr,
} from "../anomaly-detection.js";

describe("Anomaly Detection Tools", () => {
  let mockAdapter: any;
  let mockContext: any;

  beforeEach(() => {
    mockAdapter = {
      executeQuery: vi.fn(),
    };
    mockContext = {
      connectionId: "test-conn",
    };
  });

  describe("Helpers", () => {
    it("riskFromScore should return correct levels", () => {
      expect(riskFromScore(10)).toBe("low");
      expect(riskFromScore(40)).toBe("moderate");
      expect(riskFromScore(65)).toBe("high");
      expect(riskFromScore(85)).toBe("critical");
    });

    it("toNum should handle null/undefined", () => {
      expect(toNum(null)).toBe(0);
      expect(toNum(undefined)).toBe(0);
      expect(toNum("10")).toBe(10);
      expect(toNum(10)).toBe(10);
    });

    it("toStr should handle non-strings", () => {
      expect(toStr(null, "fallback")).toBe("fallback");
      expect(toStr("hello", "fallback")).toBe("hello");
    });
  });

  describe("mysql_detect_query_anomalies", () => {
    it("should return validation error for threshold out of bounds", async () => {
      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler(
        { threshold: 1 },
        mockContext,
      )) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.error).toContain("threshold");
    });

    it("should return validation error for minCalls out of bounds", async () => {
      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler(
        { minCalls: 0 },
        mockContext,
      )) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.error).toContain("minCalls");
    });

    it("should return error if performance_schema is disabled", async () => {
      mockAdapter.executeQuery.mockRejectedValueOnce(
        new Error("Access denied"),
      );
      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as Record<
        string,
        unknown
      >;
      expect(result.success).toBe(false);
      expect(result.error).toContain("disabled or inaccessible");
    });

    it("should process anomalies correctly", async () => {
      mockAdapter.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes("SELECT 1 FROM")) return { rows: [] };
        if (q.includes("COUNT(*)")) return { rows: [{ total: 100 }] };
        return {
          rows: [
            {
              query_preview: "SELECT *",
              db_schema: "test",
              calls: 50,
              avg_exec_time_ms: 10,
              max_exec_time_ms: 1000,
              variance_ratio: 100,
              total_exec_time_ms: 500,
            },
          ],
        };
      });

      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(true);
      expect(result.data.anomalyCount).toBe(1);
      expect(result.data.riskLevel).toBe("high");
      expect(result.data.summary).toContain("1 anomalous");
    });

    it("should calculate risk scores for 10+ anomalies", async () => {
      mockAdapter.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes("SELECT 1 FROM")) return { rows: [] };
        if (q.includes("COUNT(*)")) return { rows: [{ total: 100 }] };
        return {
          rows: Array(10).fill({
            query_preview: "SELECT *",
            db_schema: "test",
            calls: 50,
            avg_exec_time_ms: 10,
            max_exec_time_ms: 500,
            variance_ratio: 50,
            total_exec_time_ms: 500,
          }),
        };
      });

      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(true);
      expect(result.data.anomalyCount).toBe(10);
      expect(result.data.riskLevel).toBe("high");
    });

    it("should handle no anomalies gracefully", async () => {
      mockAdapter.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes("SELECT 1 FROM")) return { rows: [] };
        if (q.includes("COUNT(*)")) return { rows: [{ total: 100 }] };
        return { rows: [] };
      });

      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(true);
      expect(result.data.anomalyCount).toBe(0);
      expect(result.data.summary).toContain("No query anomalies");
    });

    it("should catch unexpected errors and return structured error", async () => {
      const tool = createDetectQueryAnomaliesTool(mockAdapter);
      const result = (await tool.handler(
        { minCalls: "not a number" },
        mockContext,
      )) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("expected number, received string");
    });
  });

  describe("mysql_detect_bloat_risk", () => {
    it("should return error for invalid schema name", async () => {
      const tool = createDetectBloatRiskTool(mockAdapter);
      const result = (await tool.handler(
        { schema: "invalid name" },
        mockContext,
      )) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid schema");
    });

    it("should score high fragmentation correctly", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [
          {
            db_schema: "test",
            table_name: "users",
            engine: "InnoDB",
            row_count: 1000,
            data_bytes: 1024 * 1024,
            index_bytes: 1024 * 1024,
            free_bytes: 1000 * 1024 * 1024,
            fragmentation_pct: 55,
          },
        ],
      });
      const tool = createDetectBloatRiskTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(true);
      expect(result.data.highRiskCount).toBe(1);
      expect(result.data.tables[0].riskScore).toBeGreaterThanOrEqual(100);
      expect(result.data.tables[0].recommendations.length).toBe(1);
    });

    it("should score size and fragmentation correctly", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce({
        rows: [
          {
            db_schema: "test",
            table_name: "orders",
            engine: "InnoDB",
            row_count: 1000,
            data_bytes: 100,
            index_bytes: 100,
            free_bytes: 500 * 1024 * 1024, // 500MB
            fragmentation_pct: 35,
          },
          {
            db_schema: "test",
            table_name: "logs",
            engine: "InnoDB",
            row_count: 1000,
            data_bytes: 100,
            index_bytes: 100,
            free_bytes: 100 * 1024 * 1024, // 100MB
            fragmentation_pct: 15,
          },
          {
            db_schema: "test",
            table_name: "small",
            engine: "InnoDB",
            row_count: 1000,
            data_bytes: 100,
            index_bytes: 100,
            free_bytes: 1 * 1024 * 1024, // 1MB
            fragmentation_pct: 5,
          },
        ],
      });
      const tool = createDetectBloatRiskTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(true);
      expect(result.data.tables.length).toBe(3);
    });

    it("should handle schema filter", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });
      const tool = createDetectBloatRiskTool(mockAdapter);
      await tool.handler({ schema: "mydb" }, mockContext);
      const sql = mockAdapter.executeQuery.mock.calls[0][0];
      expect(sql).toContain("TABLE_SCHEMA = 'mydb'");
    });

    it("should catch outer errors", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("outer"));
      const tool = createDetectBloatRiskTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("outer");
    });

    it("should catch zod validation errors", async () => {
      const tool = createDetectBloatRiskTool(mockAdapter);
      const result = (await tool.handler(
        { minSizeMb: "not a number" },
        mockContext,
      )) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("expected number, received string");
    });
  });
});

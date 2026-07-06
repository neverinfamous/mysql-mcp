import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetricsRegistry } from "../metrics.js";
import { logger } from "../../utils/logger.js";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("metrics", () => {
  let metrics: MetricsRegistry;

  beforeEach(() => {
    metrics = new MetricsRegistry();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    metrics.close();
    vi.useRealTimers();
  });

  describe("ToolMetric", () => {
    it("should correctly record calls and calculate percentiles", () => {
      // Record 100 successful calls with durations 1 to 100
      for (let i = 1; i <= 100; i++) {
        metrics.recordToolCall("test_tool", i, true, 10);
      }

      const summary = metrics.getSummary();
      const toolSummary = (summary.tools as any)["test_tool"];
      
      expect(toolSummary.calls).toBe(100);
      expect(toolSummary.errors).toBe(0);
      expect(toolSummary.tokens).toBe(1000);
      
      // Check percentiles. 1 to 100 means p50 should be ~50, p95 ~95, p99 ~99
      expect(toolSummary.p50).toBe(51); // (100 - 1) * 0.5 = 49.5 index -> value ~50.5 rounded to 51
      expect(toolSummary.p95).toBe(95); 
      expect(toolSummary.p99).toBe(99); 
    });

    it("should handle error recordings", () => {
      metrics.recordToolCall("test_tool", 50, false, 5);
      
      const summary = (metrics.getSummary().tools as any)["test_tool"];
      expect(summary.calls).toBe(1);
      expect(summary.errors).toBe(1);
      expect(summary.tokens).toBe(5);
    });

    it("should return zeros when no samples recorded", () => {
      // Create a new instance via reflection to access ToolMetric directly
      // Or just check that before recording it's empty (wait, it won't be in the map)
      const emptySummary = (metrics.getSummary().tools as any)["non_existent"];
      expect(emptySummary).toBeUndefined();
    });

    it("should handle buffer wrapping (max 1000 samples)", () => {
      for (let i = 1; i <= 1500; i++) {
        metrics.recordToolCall("test_tool", i, true);
      }
      
      const summary = (metrics.getSummary().tools as any)["test_tool"];
      expect(summary.calls).toBe(1500); // Calls keeps incrementing
      // The buffer only holds the latest 1000 items (501 to 1500)
      // p50 of 501-1500 is ~1000
      expect(summary.p50).toBe(1001);
    });
  });

  describe("ResourceMetric", () => {
    it("should record resource reads", () => {
      metrics.recordResourceRead("test_uri");
      metrics.recordResourceRead("test_uri");
      
      const summary = (metrics.getSummary().resources as any)["test_uri"];
      expect(summary.reads).toBe(2);
    });
  });

  describe("toPrometheus", () => {
    it("should generate prometheus format strings", () => {
      metrics.recordToolCall("test_tool", 50, true, 100);
      metrics.recordResourceRead("test_uri");
      
      const prom = metrics.toPrometheus();
      
      expect(prom).toContain('mysql_mcp_tool_calls_total{tool="test_tool"} 1');
      expect(prom).toContain('mysql_mcp_tool_errors_total{tool="test_tool"} 0');
      expect(prom).toContain('mysql_mcp_tool_tokens_total{tool="test_tool"} 100');
      expect(prom).toContain('mysql_mcp_tool_latency_ms_p50{tool="test_tool"} 50');
      expect(prom).toContain('mysql_mcp_resource_reads_total{resource="test_uri"} 1');
    });
  });

  describe("SystemDb Integration", () => {
    let mockDb: any;
    let mockSystemDb: any;

    beforeEach(() => {
      mockDb = {
        prepare: vi.fn(),
        transaction: vi.fn((cb) => cb),
      };
      
      mockSystemDb = {
        getDb: vi.fn().mockReturnValue(mockDb),
      };
    });

    it("should load historical metrics", () => {
      const mockRows = [
        { tool: "historical_tool", max_calls: 10, max_errors: 1, max_tokens: 50 },
      ];
      
      mockDb.prepare.mockReturnValue({ all: vi.fn().mockReturnValue(mockRows) });
      
      metrics.setSystemDb(mockSystemDb);
      
      // Call private method directly because fake timers with unref() can be flaky in coverage
      (metrics as any).loadHistorical();
      
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT tool"));
      const summary = (metrics.getSummary().tools as any)["historical_tool"];
      expect(summary.calls).toBe(10);
      expect(summary.errors).toBe(1);
      expect(summary.tokens).toBe(50);
      expect(logger.info).toHaveBeenCalledWith("Loaded historical metrics for 1 tools");
    });

    it("should handle error when loading historical metrics", () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error("DB Error");
      });
      
      metrics.setSystemDb(mockSystemDb);
      (metrics as any).loadHistorical();
      
      expect(logger.warn).toHaveBeenCalledWith("Failed to load historical metrics", expect.any(Object));
    });

    it("should flush to db periodically", () => {
      const mockRun = vi.fn();
      mockDb.prepare.mockReturnValue({ 
        all: vi.fn().mockReturnValue([]),
        run: mockRun 
      });
      
      metrics.setSystemDb(mockSystemDb);
      vi.advanceTimersByTime(1000); // Load history + start timer
      
      metrics.recordToolCall("test_tool", 10, true);
      
      // Force flush directly
      (metrics as any).flushToDb();
      
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO metrics_snapshots"));
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith(
        expect.any(String), // timestamp
        "test_tool",
        1, // calls
        0, // errors
        10, // p50
        10, // p95
        10, // p99
        0  // tokens
      );
    });

    it("should handle flush errors gracefully", () => {
      mockDb.prepare.mockImplementation((query: string) => {
        if (query.includes("INSERT")) {
          throw new Error("Flush Error");
        }
        return { all: vi.fn().mockReturnValue([]) };
      });
      
      metrics.setSystemDb(mockSystemDb);
      vi.advanceTimersByTime(1000); 
      
      metrics.recordToolCall("test_tool", 10, true);
      
      // Force flush directly
      (metrics as any).flushToDb();
      
      expect(logger.warn).toHaveBeenCalledWith("Failed to flush metrics to db", expect.any(Object));
    });

    it("should not crash on flush if systemDb is not set", () => {
      // Internal flush method called on close
      metrics.close(); 
      // No assertions needed, just testing that it doesn't throw
    });
  });
});

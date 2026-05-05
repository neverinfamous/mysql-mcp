import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDetectConnectionSpikeTool } from "../connection-analysis.js";

describe("Connection Analysis Tools", () => {
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

  describe("mysql_detect_connection_spike", () => {
    it("should return validation error for warningPercent out of bounds", async () => {
      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({ warningPercent: 101 }, mockContext) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.error).toContain("warningPercent");
    });

    it("should return validation error for windowMinutes out of bounds", async () => {
      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({ windowMinutes: 0 }, mockContext) as Record<string, unknown>;
      expect(result.success).toBe(false);
      expect(result.error).toContain("windowMinutes");
    });

    it("should process normal connections correctly", async () => {
      mockAdapter.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes("PROCESSLIST")) {
          return {
            rows: [
              { ID: 1, USER: "system user", HOST: "localhost", COMMAND: "Daemon", TIME: 10, STATE: "Running" },
              { ID: 2, USER: "app", HOST: "192.168.1.1:1234", COMMAND: "Query", TIME: 1, STATE: "executing" },
              { ID: 3, USER: "app", HOST: "192.168.1.2:1235", COMMAND: "Sleep", TIME: 5, STATE: "idle" },
            ]
          };
        }
        if (q.includes("max_connections")) {
          return { rows: [{ Value: "100" }] };
        }
        return { rows: [] };
      });

      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({}, mockContext) as any;
      
      expect(result.success).toBe(true);
      expect(result.data.totalConnections).toBe(2);
      expect(result.data.maxConnections).toBe(100);
      expect(result.data.usagePercent).toBe(2);
      expect(result.data.concentrations.length).toBe(1);
      expect(result.data.warnings.length).toBe(1);
      expect(result.data.riskLevel).toBe("low");
    });

    it("should detect user concentration and long sleep", async () => {
      mockAdapter.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes("PROCESSLIST")) {
          return {
            rows: Array(8).fill(null).map((_, i) => ({
              ID: i + 1, USER: "baduser", HOST: "10.0.0.1:4321", COMMAND: "Sleep", TIME: 400, STATE: "idle"
            })).concat([
              { ID: 9, USER: "otheruser", HOST: "10.0.0.2:4321", COMMAND: "Query", TIME: 1, STATE: "executing" },
              { ID: 10, USER: "otheruser", HOST: "10.0.0.2:4322", COMMAND: "Query", TIME: 1, STATE: "executing" }
            ])
          };
        }
        if (q.includes("max_connections")) {
          return { rows: [{ Value: "10" }] }; // 10 max connections
        }
        return { rows: [] };
      });

      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({ windowMinutes: 5, warningPercent: 70 }, mockContext) as any;
      console.log("RESULT USER CONC:", JSON.stringify(result.data, null, 2));
      
      expect(result.success).toBe(true);
      expect(result.data.totalConnections).toBe(10);
      expect(result.data.maxConnections).toBe(10);
      expect(result.data.usagePercent).toBe(100); // 10/10

      // Concentration (baduser is 8/10 = 80%, host 10.0.0.1 is 80%)
      expect(result.data.concentrations.length).toBeGreaterThanOrEqual(2);
      
      // Warnings: critical pressure, long idle
      expect(result.data.warnings).toContainEqual(expect.stringContaining("Critical connection pressure"));
      expect(result.data.warnings).toContainEqual(expect.stringContaining("sleeping for >5 minutes"));
      
      expect(result.data.riskLevel).toBe("high");
    });

    it("should detect high connection pressure and 50+ sleep buildup", async () => {
      mockAdapter.executeQuery.mockImplementation(async (q: string) => {
        if (q.includes("PROCESSLIST")) {
          return {
            // 60 sleeping connections, out of 85 total
            rows: Array(60).fill({ USER: "app", HOST: "10.0.0.1", COMMAND: "Sleep", TIME: 10 }).concat(
              Array(25).fill({ USER: "app", HOST: "10.0.0.2", COMMAND: "Query", TIME: 1 })
            )
          };
        }
        if (q.includes("max_connections")) {
          return { rows: [{ Value: "100" }] }; // 85% usage
        }
        return { rows: [] };
      });

      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({}, mockContext) as any;
      
      expect(result.success).toBe(true);
      expect(result.data.usagePercent).toBe(85);
      expect(result.data.warnings).toContainEqual(expect.stringContaining("High connection pressure"));
      expect(result.data.warnings).toContainEqual(expect.stringContaining("60 total sleeping connections"));
    });

    it("should catch unexpected errors and return structured error", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("unexpected"));
      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({}, mockContext) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("unexpected");
    });

    it("should catch zod validation errors", async () => {
      const tool = createDetectConnectionSpikeTool(mockAdapter);
      const result = await tool.handler({ warningPercent: "not a number" }, mockContext) as any;
      expect(result.success).toBe(false);
      expect(result.error).toContain("expected number");
    });
  });
});

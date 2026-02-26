/**
 * mysql-mcp - Monitoring Summary & Edge Cases Tests
 *
 * Tests for parseInnodbStatusSummary (via summary=true),
 * InnoDB ZodError path, and replication double-failure path.
 * These target lines 209-289, 330-332, 374, 381 in monitoring.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createInnodbStatusTool,
  createReplicationStatusTool,
  createShowStatusTool,
  createShowVariablesTool,
} from "../monitoring.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Monitoring Summary & Edge Cases", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  // ===========================================================================
  // InnoDB Status with summary=true (exercises parseInnodbStatusSummary)
  // ===========================================================================
  describe("InnoDB status summary mode", () => {
    it("should parse buffer pool metrics from raw status", async () => {
      const rawStatus = [
        "BACKGROUND THREAD",
        "Buffer pool size   16384",
        "Free buffers       1024",
        "Buffer pool hit rate 999 / 1000",
        "END OF INNODB MONITOR OUTPUT",
      ].join("\n");

      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Status: rawStatus }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      expect(result.summary).toBeDefined();
      const bp = result.summary["bufferPool"] as Record<string, unknown>;
      expect(bp).toBeDefined();
      expect(bp["size"]).toBe(16384);
      expect(bp["freeBuffers"]).toBe(1024);
      expect(bp["hitRate"]).toBe("999/1000");
    });

    it("should parse row operations metrics", async () => {
      const rawStatus =
        "1.50 inserts/s, 2.75 updates/s, 0.25 deletes/s, 100.00 reads/s";

      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Status: rawStatus }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      const ops = result.summary["rowOperations"] as Record<string, number>;
      expect(ops).toBeDefined();
      expect(ops["insertsPerSec"]).toBe(1.5);
      expect(ops["updatesPerSec"]).toBe(2.75);
      expect(ops["deletesPerSec"]).toBe(0.25);
      expect(ops["readsPerSec"]).toBe(100.0);
    });

    it("should parse log section metrics", async () => {
      const rawStatus = [
        "Log sequence number 123456789",
        "Last checkpoint at  123456000",
      ].join("\n");

      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Status: rawStatus }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      const log = result.summary["log"] as Record<string, number>;
      expect(log).toBeDefined();
      expect(log["sequenceNumber"]).toBe(123456789);
      expect(log["lastCheckpoint"]).toBe(123456000);
    });

    it("should parse transactions section", async () => {
      const rawStatus = [
        "History list length 100",
        "Trx id counter 456789",
      ].join("\n");

      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Status: rawStatus }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      const trx = result.summary["transactions"] as Record<string, number>;
      expect(trx).toBeDefined();
      expect(trx["historyListLength"]).toBe(100);
      expect(trx["trxIdCounter"]).toBe(456789);
    });

    it("should parse semaphores section", async () => {
      const rawStatus = "OS WAIT ARRAY INFO: reservation count 42";

      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Status: rawStatus }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      const sem = result.summary["semaphores"] as Record<string, number>;
      expect(sem).toBeDefined();
      expect(sem["osWaitReservations"]).toBe(42);
    });

    it("should return empty summary for status without matching patterns", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ Status: "Nothing relevant here" }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      expect(result.summary).toBeDefined();
      expect(Object.keys(result.summary)).toHaveLength(0);
    });

    it("should handle empty rows for summary mode", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      expect(result.summary).toBeDefined();
    });

    it("should handle STATUS column name in uppercase", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([{ STATUS: "Buffer pool size   8192" }]),
      );

      const tool = createInnodbStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ summary: true }, mockContext)) as {
        summary: Record<string, unknown>;
      };

      expect(result.summary).toBeDefined();
    });
  });

  // ===========================================================================
  // Replication double-failure and SHOW SLAVE STATUS fallback
  // ===========================================================================
  describe("replication edge cases", () => {
    it("should handle both REPLICA and SLAVE STATUS failing", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("REPLICA not supported"))
        .mockRejectedValueOnce(new Error("SLAVE not supported"));

      const tool = createReplicationStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        configured: boolean;
        message: string;
      };

      expect(result.configured).toBe(false);
      expect(result.message).toContain("not configured");
    });

    it("should handle SHOW SLAVE STATUS returning empty rows", async () => {
      mockAdapter.executeQuery
        .mockRejectedValueOnce(new Error("REPLICA not supported"))
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createReplicationStatusTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        configured: boolean;
        message: string;
      };

      expect(result.configured).toBe(false);
      expect(result.message).toContain("not configured");
    });
  });

  // ===========================================================================
  // ShowStatus and ShowVariables - limit < 1 validation path
  // ===========================================================================
  describe("status/variables limit validation", () => {
    it("should reject limit < 1 in showStatus", async () => {
      const tool = createShowStatusTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({ limit: 0 }, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("limit must be a positive integer");
    });

    it("should reject limit < 1 in showVariables", async () => {
      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({ limit: 0 }, mockContext)) as {
        success: boolean;
        error: string;
      };
      expect(result.success).toBe(false);
      expect(result.error).toContain("limit must be a positive integer");
    });

    it("should handle showVariables with LIKE and session", async () => {
      mockAdapter.rawQuery.mockResolvedValue(createMockQueryResult([]));
      const tool = createShowVariablesTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ global: false, like: "max_%" }, mockContext);
      const call = mockAdapter.rawQuery.mock.calls[0][0] as string;
      expect(call).not.toContain("GLOBAL");
      expect(call).toContain("LIKE 'max_%'");
    });
  });
});

/**
 * mysql-mcp - Sys Schema Performance Tools Unit Tests
 *
 * Comprehensive tests for performance.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSysStatementSummaryTool,
  createSysWaitSummaryTool,
  createSysIOSummaryTool,
} from "../performance.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Sys Schema Performance Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSysStatementSummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysStatementSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_statement_summary");
    });

    it("should query statement summary", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            query: "SELECT 1",
            exec_count: 10,
          },
        ]),
      );

      const tool = createSysStatementSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ limit: 5 }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.statement_analysis");
      expect(result).toHaveProperty("statements");
    });

    it("should allow custom ordering", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysStatementSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ orderBy: "exec_count" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("ORDER BY exec_count DESC");
    });
  });

  describe("createSysWaitSummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysWaitSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_wait_summary");
    });

    it("should query global wait summary by default", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysWaitSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({}, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.waits_global_by_latency");
    });

    it("should query by host", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysWaitSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ type: "by_host" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.waits_by_host_by_latency");
    });

    it("should query by user", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysWaitSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ type: "by_user" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.waits_by_user_by_latency");
    });

    it("should query by instance", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysWaitSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ type: "by_instance" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "performance_schema.events_waits_summary_by_instance",
      );
    });
  });

  describe("createSysIOSummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysIOSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_io_summary");
    });

    it("should query table IO summary by default", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysIOSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({}, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.schema_table_statistics");
    });

    it("should query file IO summary", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysIOSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ type: "file" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.io_global_by_file_by_bytes");
      // Ensure correct column name is used (total_written, not total_write)
      expect(call).toContain("total_written");
      expect(call).not.toContain("total_write,");
    });

    it("should query global IO summary", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysIOSummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ type: "global" }, mockContext);

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.io_global_by_wait_by_latency");
      expect(call).toContain("event_name");
    });
  });
});

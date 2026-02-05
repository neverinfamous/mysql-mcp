/**
 * mysql-mcp - Sys Schema Resource Tools Unit Tests
 *
 * Comprehensive tests for resources.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createSysSchemaStatsTool,
  createSysInnoDBLockWaitsTool,
  createSysMemorySummaryTool,
} from "../resources.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Sys Schema Resource Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createSysSchemaStatsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_schema_stats");
    });

    it("should query schema stats (tables, indexes, auto-inc)", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ table_name: "t1" }])) // Tables
        .mockResolvedValueOnce(createMockQueryResult([{ index_name: "idx1" }])) // Indexes
        .mockResolvedValueOnce(createMockQueryResult([{ column_name: "id" }])); // Auto-inc

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        tableStatistics: unknown[];
        indexStatistics: unknown[];
        autoIncrementStatus: unknown[];
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(result.tableStatistics).toHaveLength(1);
      expect(result.indexStatistics).toHaveLength(1);
      expect(result.autoIncrementStatus).toHaveLength(1);
    });

    it("should filter by schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ schema: "test_db" }, mockContext);

      // Check first call (tables)
      const args = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(args).toContain("test_db");
    });

    it("should handle null/undefined rows", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        fields: [],
        rows: null,
      } as any);

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.tableStatistics).toEqual([]);
      expect(result.indexStatistics).toEqual([]);
      expect(result.autoIncrementStatus).toEqual([]);
    });
  });

  describe("createSysInnoDBLockWaitsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_innodb_lock_waits");
    });

    it("should query lock waits", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            blocking_trx_id: "1235",
            waiting_trx_id: "1234",
          },
        ]),
      );

      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        hasContention: boolean;
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("sys.innodb_lock_waits");
      expect(result.hasContention).toBe(true);
    });

    it("should handle empty result (no contention)", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        hasContention: boolean;
      };

      expect(result.hasContention).toBe(false);
    });

    it("should handle null rows", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        fields: [],
        rows: null,
      } as any);

      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.lockWaits).toBeNull(); // or null, queryResult.rows is returned directly
      expect(result.count).toBe(0);
      expect(result.hasContention).toBe(false);
    });
  });

  describe("createSysMemorySummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysMemorySummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_sys_memory_summary");
    });

    it("should query memory stats (global and user)", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ event_name: "memory/innodb/buf_buf_pool" }]),
        ) // Global
        .mockResolvedValueOnce(createMockQueryResult([{ user: "root" }])); // User

      const tool = createSysMemorySummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        globalMemory: unknown[];
        memoryByUser: unknown[];
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result.globalMemory).toHaveLength(1);
      expect(result.memoryByUser).toHaveLength(1);
    });

    it("should handle null rows", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        fields: [],
        rows: null,
      } as any);

      const tool = createSysMemorySummaryTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as any;

      expect(result.globalMemory).toEqual([]);
      expect(result.memoryByUser).toEqual([]);
    });
  });
});

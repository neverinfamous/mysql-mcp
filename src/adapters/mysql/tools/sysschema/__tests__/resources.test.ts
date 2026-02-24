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
      // Mock SELECT DATABASE()
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ db: "testdb" }]),
      );
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
        tableStatisticsCount: number;
        indexStatisticsCount: number;
        autoIncrementStatusCount: number;
        schemaName: string;
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(4);
      expect(result.tableStatistics).toHaveLength(1);
      expect(result.indexStatistics).toHaveLength(1);
      expect(result.autoIncrementStatus).toHaveLength(1);
      expect(result.tableStatisticsCount).toBe(1);
      expect(result.indexStatisticsCount).toBe(1);
      expect(result.autoIncrementStatusCount).toBe(1);
      expect(result.schemaName).toBe("testdb");
    });

    it("should use default limit of 10", async () => {
      // Mock SELECT DATABASE()
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ db: "testdb" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({}, mockContext);

      // First call is SELECT DATABASE(), second is table stats
      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(call).toContain("LIMIT 10");
    });

    it("should filter by schema with existence check", async () => {
      // Mock schema existence check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "test_db" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ schema: "test_db" }, mockContext);

      // First call is schema existence check
      const schemaCheck = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(schemaCheck).toContain("information_schema.SCHEMATA");
      // Second call is table stats with schema param
      const args = mockAdapter.executeQuery.mock.calls[1][1] as unknown[];
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
      expect(result.tableStatisticsCount).toBe(0);
      expect(result.indexStatisticsCount).toBe(0);
      expect(result.autoIncrementStatusCount).toBe(0);
    });

    it("should return structured error for nonexistent schema (P154)", async () => {
      // Mock schema existence check returning empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result).toEqual({
        success: false,
        error: "Schema 'nonexistent_db' does not exist",
      });
      // Should only call the schema check, not the 3 stats queries
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });

    it("should resolve actual database name when schema not provided", async () => {
      // Mock SELECT DATABASE()
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ db: "real_db_name" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        schemaName: string;
        tableStatisticsCount: number;
        indexStatisticsCount: number;
        autoIncrementStatusCount: number;
      };

      expect(result.schemaName).toBe("real_db_name");
      expect(result.tableStatisticsCount).toBe(0);
      expect(result.indexStatisticsCount).toBe(0);
      expect(result.autoIncrementStatusCount).toBe(0);
      // First call should be SELECT DATABASE()
      const firstCall = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(firstCall).toContain("SELECT DATABASE()");
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
        globalMemoryCount: number;
        memoryByUserCount: number;
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result.globalMemory).toHaveLength(1);
      expect(result.memoryByUser).toHaveLength(1);
      expect(result.globalMemoryCount).toBe(1);
      expect(result.memoryByUserCount).toBe(1);
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
      expect(result.globalMemoryCount).toBe(0);
      expect(result.memoryByUserCount).toBe(0);
    });
  });
});

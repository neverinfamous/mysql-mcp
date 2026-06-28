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
import type {} from "../../../mysql-adapter/index.js";
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
        mockAdapter,
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
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          tableStatistics: unknown[];
          indexStatistics: unknown[];
          autoIncrementStatus: unknown[];
          tableStatisticsCount: number;
          indexStatisticsCount: number;
          autoIncrementStatusCount: number;
          schemaName: string;
        };
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(4);
      expect(result.data.tableStatistics).toHaveLength(1);
      expect(result.data.indexStatistics).toHaveLength(1);
      expect(result.data.autoIncrementStatus).toHaveLength(1);
      expect(result.data?.tableStatisticsCount).toBe(1);
      expect(result.data?.indexStatisticsCount).toBe(1);
      expect(result.data?.autoIncrementStatusCount).toBe(1);
      expect(result.data?.schemaName).toBe("testdb");
    });

    it("should use default limit of 5", async () => {
      // Mock SELECT DATABASE()
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ db: "testdb" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter,
      );
      await tool.handler({}, mockContext);

      // First call is SELECT DATABASE(), second is table stats
      const call = mockAdapter.executeQuery.mock.calls[1][0];
      expect(call).toContain("LIMIT 5");
    });

    it("should filter by schema with existence check", async () => {
      // Mock schema existence check
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "test_db" }]),
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter,
      );
      await tool.handler({ schema: "test_db" }, mockContext);

      // First call is schema existence check
      const schemaCheck = mockAdapter.executeQuery.mock.calls[0][0];
      expect(schemaCheck).toContain("information_schema.SCHEMATA");
      // Second call is table stats with schema param
      const args = mockAdapter.executeQuery.mock.calls[1][1];
      expect(args).toContain("test_db");
    });

    it("should handle null/undefined rows", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        fields: [],
        rows: undefined,
      });

      const tool = createSysSchemaStatsTool(
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          tableStatistics: unknown[];
          indexStatistics: unknown[];
          autoIncrementStatus: unknown[];
          tableStatisticsCount: number;
          indexStatisticsCount: number;
          autoIncrementStatusCount: number;
        };
      };

      expect(result.data.tableStatistics).toEqual([]);
      expect(result.data.indexStatistics).toEqual([]);
      expect(result.data.autoIncrementStatus).toEqual([]);
      expect(result.data?.tableStatisticsCount).toBe(0);
      expect(result.data?.indexStatisticsCount).toBe(0);
      expect(result.data?.autoIncrementStatusCount).toBe(0);
    });

    it("should return structured error for nonexistent schema (P154)", async () => {
      // Mock schema existence check returning empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createSysSchemaStatsTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result).toEqual(
        expect.objectContaining({
          success: false,
          error: "Schema 'nonexistent_db' does not exist",
        }),
      );
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
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          schemaName: string;
          tableStatisticsCount: number;
          indexStatisticsCount: number;
          autoIncrementStatusCount: number;
        };
      };

      expect(result.data?.schemaName).toBe("real_db_name");
      expect(result.data?.tableStatisticsCount).toBe(0);
      expect(result.data?.indexStatisticsCount).toBe(0);
      expect(result.data?.autoIncrementStatusCount).toBe(0);
      // First call should be SELECT DATABASE()
      const firstCall = mockAdapter.executeQuery.mock.calls[0][0];
      expect(firstCall).toContain("SELECT DATABASE()");
    });
  });

  describe("createSysInnoDBLockWaitsTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter,
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
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          hasContention: boolean;
        };
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0];
      expect(call).toContain("sys.innodb_lock_waits");
      expect(result.data?.hasContention).toBe(true);
    });

    it("should handle empty result (no contention)", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          hasContention: boolean;
        };
      };

      expect(result.data?.hasContention).toBe(false);
    });

    it("should handle null rows", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        fields: [],
        rows: undefined,
      });

      const tool = createSysInnoDBLockWaitsTool(
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          rows?: unknown[];
          count?: number;
          hasContention?: boolean;
        };
      };

      expect(result.data?.rows).toBeUndefined(); 
      expect(result.data?.count).toBe(0);
      expect(result.data?.hasContention).toBe(false);
    });
  });

  describe("createSysMemorySummaryTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createSysMemorySummaryTool(
        mockAdapter,
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
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          globalMemory: unknown[];
          memoryByUser: unknown[];
          globalMemoryCount: number;
          memoryByUserCount: number;
        };
      };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      expect(result.data.globalMemory).toHaveLength(1);
      expect(result.data.memoryByUser).toHaveLength(1);
      expect(result.data?.globalMemoryCount).toBe(1);
      expect(result.data?.memoryByUserCount).toBe(1);
    });

    it("should handle null rows", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        fields: [],
        rows: undefined,
      });

      const tool = createSysMemorySummaryTool(
        mockAdapter,
      );
      const result = (await tool.handler({}, mockContext)) as {
        data: {
          globalMemory: unknown[];
          memoryByUser: unknown[];
          globalMemoryCount: number;
          memoryByUserCount: number;
        };
      };

      expect(result.data.globalMemory).toEqual([]);
      expect(result.data.memoryByUser).toEqual([]);
      expect(result.data?.globalMemoryCount).toBe(0);
      expect(result.data?.memoryByUserCount).toBe(0);
    });
  });
});

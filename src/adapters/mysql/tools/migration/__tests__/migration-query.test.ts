import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMigrationRollbackTool,
  createMigrationHistoryTool,
  createMigrationStatusTool,
} from "../migration-query.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Migration Query Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();

    // Default mock behavior
    mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
      if (query.includes("SELECT DATABASE()")) {
        return createMockQueryResult([{ db: "testdb" }]);
      }
      if (query.includes("information_schema.TABLES")) {
        return createMockQueryResult([{ table_exists: 1 }]);
      }
      return createMockQueryResult([]);
    });
  });

  describe("Migration Rollback Tool", () => {
    let tool: ReturnType<typeof createMigrationRollbackTool>;

    beforeEach(() => {
      tool = createMigrationRollbackTool(
        mockAdapter,
      );
    });

    it("should rollback a migration by id", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("LIMIT 1")) {
          return createMockQueryResult([
            {
              id: 1,
              version: "1.0",
              status: "applied",
              rollback_sql: "DROP TABLE a",
            },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ id: 1 }, mockContext);

      expect(Reflect.get(result || {}, "success")).toBe(true);

      const calls = mockAdapter.executeWriteQuery.mock.calls;
      const executedQueries = calls.map((c) => c[0]);

      // Should execute rollback SQL
      expect(executedQueries.includes("DROP TABLE a")).toBe(true);
      // Should update status
      expect(
        executedQueries.some(
          (q) => q.includes("UPDATE") && q.includes("status = 'rolled_back'"),
        ),
      ).toBe(true);
    });

    it("should handle dryRun", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.TABLES")) {
          return createMockQueryResult([{ table_exists: 1 }]);
        }
        if (query.includes("LIMIT 1")) {
          return createMockQueryResult([
            {
              id: 1,
              version: "1.0",
              status: "applied",
              rollback_sql: "DROP TABLE a",
            },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { version: "1.0", dryRun: true },
        mockContext,
      );

      expect(Reflect.get(result || {}, "success")).toBe(true);
      expect(Reflect.get(result || {}, "data").dryRun).toBe(true);
      expect(Reflect.get(result || {}, "data").rollbackSql).toBe("DROP TABLE a");

      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
    });

    it("should reject if no rollback SQL exists", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("LIMIT 1")) {
          return createMockQueryResult([
            { id: 1, version: "1.0", status: "applied", rollback_sql: null },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ version: "1.0" }, mockContext);

      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("no rollback SQL stored");
    });
  });

  describe("Migration History Tool", () => {
    let tool: ReturnType<typeof createMigrationHistoryTool>;

    beforeEach(() => {
      tool = createMigrationHistoryTool(mockAdapter);
    });

    it("should retrieve history with pagination", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("COUNT(*)")) {
          return createMockQueryResult([{ count: 2 }]);
        }
        if (query.includes("SELECT m.id")) {
          return createMockQueryResult([
            { id: 2, version: "2.0", status: "applied" },
            { id: 1, version: "1.0", status: "applied" },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ limit: 10, offset: 0 }, mockContext);

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.total).toBe(2);
      expect(data.records.length).toBe(2);
      expect(data.records[0].version).toBe("2.0");
    });

    it("should apply status filters", async () => {
      mockAdapter.executeReadQuery.mockImplementation(
        async (query: string, values: any[]) => {
          if (query.includes("SELECT m.id")) {
            expect(query).toContain("status = ?");
            expect(values).toContain("failed");
            return createMockQueryResult([
              { id: 3, version: "3.0", status: "failed" },
            ]);
          }
          return createMockQueryResult([]);
        },
      );

      const result = await tool.handler({ status: "failed" }, mockContext);
      expect(Reflect.get(result || {}, "success")).toBe(true);
    });
  });

  describe("Migration Status Tool", () => {
    let tool: ReturnType<typeof createMigrationStatusTool>;

    beforeEach(() => {
      tool = createMigrationStatusTool(mockAdapter);
    });

    it("should return initialized false if table is missing", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.TABLES"))
          return createMockQueryResult([{ table_exists: 0 }]);
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect(Reflect.get(result || {}, "success")).toBe(true);
      expect(Reflect.get(result || {}, "data").initialized).toBe(false);
    });

    it("should return aggregated status when table exists", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.TABLES"))
          return createMockQueryResult([{ table_exists: 1 }]);
        if (query.includes("COUNT(*)"))
          return createMockQueryResult([{ total: 10, applied: 8, failed: 2 }]);
        if (query.includes("ORDER BY applied_at DESC LIMIT 1"))
          return createMockQueryResult([
            { version: "2.0", applied_at: new Date() },
          ]);
        if (query.includes("DISTINCT source_system"))
          return createMockQueryResult([{ source_system: "agent" }]);
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.initialized).toBe(true);
      expect(data.latestVersion).toBe("2.0");
      expect(data.counts.total).toBe(10);
      expect(data.sourceSystems).toEqual(["agent"]);
    });
  });
});

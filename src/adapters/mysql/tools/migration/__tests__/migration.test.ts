import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMigrationInitTool,
  createMigrationRecordTool,
  createMigrationApplyTool,
} from "../migration.js";
import type { MySQLAdapter } from "../../../mysql-adapter.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Migration Core Tools", () => {
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
        // Assume table doesn't exist by default for init test
        return createMockQueryResult([{ table_exists: 0 }]);
      }
      if (query.includes("COUNT(*)")) {
        return createMockQueryResult([{ count: 0 }]);
      }
      if (query.includes("LIMIT 1")) {
        return createMockQueryResult([
          {
            id: 1,
            version: "1.0",
            status: "recorded",
            migration_hash: "mockhash",
            migration_sql: "CREATE TABLE a (id INT)",
          },
        ]);
      }
      return createMockQueryResult([]);
    });
  });

  describe("Migration Init Tool", () => {
    let tool: ReturnType<typeof createMigrationInitTool>;

    beforeEach(() => {
      tool = createMigrationInitTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should initialize the tracking table", async () => {
      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect((result as any).success).toBe(true);
      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();

      const sqlCall = mockAdapter.executeWriteQuery.mock
        .calls[0]?.[0] as string;
      expect(sqlCall).toContain(
        "CREATE TABLE IF NOT EXISTS testdb._mcp_schema_versions",
      );
    });

    it("should return correct metrics if table already exists", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.TABLES"))
          return createMockQueryResult([{ table_exists: 1 }]);
        if (query.includes("COUNT(*)"))
          return createMockQueryResult([{ count: 5 }]);
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect((result as any).success).toBe(true);
      expect((result as any).data.tableCreated).toBe(false);
      expect((result as any).data.existingRecords).toBe(5);
      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
    });
  });

  describe("Migration Record Tool", () => {
    let tool: ReturnType<typeof createMigrationRecordTool>;

    beforeEach(() => {
      tool = createMigrationRecordTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should record a migration without executing DDL", async () => {
      const result = await tool.handler(
        { version: "1.0", migrationSql: "CREATE TABLE a (id INT)" },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      // Ensure tracking table check/create
      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();

      // Should insert into the tracking table, but should NOT execute the migrationSql itself
      const calls = mockAdapter.executeWriteQuery.mock.calls;
      const executedQueries = calls.map((c) => c[0] as string);

      expect(
        executedQueries.some((q) =>
          q.includes("INSERT INTO testdb._mcp_schema_versions"),
        ),
      ).toBe(true);
      expect(executedQueries.some((q) => q === "CREATE TABLE a (id INT)")).toBe(
        false,
      );
    });

    it("should reject duplicate applied migrations", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("SELECT id, version, status")) {
          // Simulate duplicate
          return createMockQueryResult([
            { id: 1, version: "1.0", status: "applied" },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler(
        { version: "1.0", migrationSql: "CREATE TABLE a (id INT)" },
        mockContext,
      );

      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain("already been applied");
    });
  });

  describe("Migration Apply Tool", () => {
    let tool: ReturnType<typeof createMigrationApplyTool>;

    beforeEach(() => {
      tool = createMigrationApplyTool(mockAdapter as unknown as MySQLAdapter);
    });

    it("should execute migration SQL and record it", async () => {
      const result = await tool.handler(
        { version: "1.0", migrationSql: "CREATE TABLE b (id INT)" },
        mockContext,
      );

      expect((result as any).success).toBe(true);

      const calls = mockAdapter.executeWriteQuery.mock.calls;
      const executedQueries = calls.map((c) => c[0] as string);

      // Should execute the actual migration
      expect(executedQueries.includes("CREATE TABLE b (id INT)")).toBe(true);
      // Should insert into tracking table
      expect(
        executedQueries.some((q) =>
          q.includes("INSERT INTO testdb._mcp_schema_versions"),
        ),
      ).toBe(true);
    });

    it("should record failure if migration throws", async () => {
      // Setup mock to throw on the actual migration query, but not on tracking table creation or failure insert
      mockAdapter.executeWriteQuery.mockImplementation(
        async (query: string) => {
          if (query === "CREATE TABLE bad (id INT)") {
            throw new Error("Syntax error");
          }
        },
      );

      const result = await tool.handler(
        { version: "1.0", migrationSql: "CREATE TABLE bad (id INT)" },
        mockContext,
      );

      expect((result as any).success).toBe(false);
      expect((result as any).error).toContain("Syntax error");

      // Should have attempted to record the failure
      const calls = mockAdapter.executeWriteQuery.mock.calls;
      const executedQueries = calls.map((c) => c[0] as string);
      expect(
        executedQueries.some(
          (q) => q.includes("VALUES") && q.includes("'failed'"),
        ),
      ).toBe(true);
    });
  });
});

/**
 * mysql-mcp - Core Tools Unit Tests
 *
 * Tests for core database operations with focus on tool definitions,
 * schema validation, and handler execution behavior.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCoreTools } from "../core.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

describe("getCoreTools", () => {
  let adapter: MySQLAdapter;
  let tools: ReturnType<typeof getCoreTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockMySQLAdapter() as unknown as MySQLAdapter;
    tools = getCoreTools(adapter);
  });

  it("should return 8 core tools", () => {
    expect(tools).toHaveLength(8);
  });

  it("should include all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("mysql_read_query");
    expect(toolNames).toContain("mysql_write_query");
    expect(toolNames).toContain("mysql_list_tables");
    expect(toolNames).toContain("mysql_describe_table");
    expect(toolNames).toContain("mysql_create_table");
    expect(toolNames).toContain("mysql_drop_table");
    expect(toolNames).toContain("mysql_create_index");
    expect(toolNames).toContain("mysql_get_indexes");
  });

  it("should have core group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("core");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });
});

describe("Tool Annotations", () => {
  let tools: ReturnType<typeof getCoreTools>;

  beforeEach(() => {
    tools = getCoreTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("mysql_read_query should be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_read_query")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("mysql_write_query should not be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_write_query")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("mysql_list_tables should be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_list_tables")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("mysql_describe_table should be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_describe_table")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("mysql_drop_table should be destructive", () => {
    const tool = tools.find((t) => t.name === "mysql_drop_table")!;
    expect(tool.annotations?.destructiveHint).toBe(true);
  });

  it("mysql_get_indexes should be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_get_indexes")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });
});

describe("Required Scopes", () => {
  let tools: ReturnType<typeof getCoreTools>;

  beforeEach(() => {
    tools = getCoreTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("read_query should require read scope", () => {
    const tool = tools.find((t) => t.name === "mysql_read_query")!;
    expect(tool.requiredScopes).toContain("read");
  });

  it("write_query should require write scope", () => {
    const tool = tools.find((t) => t.name === "mysql_write_query")!;
    expect(tool.requiredScopes).toContain("write");
  });

  it("drop_table should require admin scope", () => {
    const tool = tools.find((t) => t.name === "mysql_drop_table")!;
    expect(
      tool.requiredScopes?.some((s) => s === "write" || s === "admin"),
    ).toBe(true);
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getCoreTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getCoreTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_read_query", () => {
    it("should execute read query and return result", async () => {
      const expectedResult = createMockQueryResult([{ id: 1, name: "test" }]);
      mockAdapter.executeReadQuery.mockResolvedValue(expectedResult);

      const tool = tools.find((t) => t.name === "mysql_read_query")!;
      const result = await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "SELECT * FROM users",
        undefined,
        undefined,
      );
      expect(result).toBeDefined();
    });

    it("should pass parameters to executeReadQuery", async () => {
      const tool = tools.find((t) => t.name === "mysql_read_query")!;
      await tool.handler(
        { query: "SELECT * FROM users WHERE id = ?", params: [1] },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [1],
        undefined,
      );
    });

    it("should pass transactionId to executeReadQuery when provided", async () => {
      const tool = tools.find((t) => t.name === "mysql_read_query")!;
      await tool.handler(
        { query: "SELECT * FROM users", transactionId: "txn-123" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "SELECT * FROM users",
        undefined,
        "txn-123",
      );
    });

    it("should return structured error for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = tools.find((t) => t.name === "mysql_read_query")!;
      const result = await tool.handler(
        { query: "SELECT * FROM nonexistent" },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toContain(
        "doesn't exist",
      );
    });

    it("should return structured error for non-table errors in read query", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Access denied"),
      );

      const tool = tools.find((t) => t.name === "mysql_read_query")!;
      const result = await tool.handler(
        { query: "SELECT * FROM users" },
        mockContext,
      );

      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toContain(
        "Access denied",
      );
    });
  });

  describe("mysql_write_query", () => {
    it("should execute write query and return affected rows", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 5,
        executionTimeMs: 10,
      });

      const tool = tools.find((t) => t.name === "mysql_write_query")!;
      const result = await tool.handler(
        { query: "UPDATE users SET status = 1" },
        mockContext,
      );

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalledWith(
        "UPDATE users SET status = 1",
        undefined,
        undefined,
      );
      expect(result).toBeDefined();
    });

    it("should pass transactionId to executeWriteQuery when provided", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_write_query")!;
      await tool.handler(
        { query: "INSERT INTO users VALUES (1)", transactionId: "txn-456" },
        mockContext,
      );

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalledWith(
        "INSERT INTO users VALUES (1)",
        undefined,
        "txn-456",
      );
    });

    it("should return structured error for nonexistent table", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = tools.find((t) => t.name === "mysql_write_query")!;
      const result = await tool.handler(
        { query: "INSERT INTO nonexistent (id) VALUES (1)" },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toContain(
        "doesn't exist",
      );
    });

    it("should return structured error for non-table errors in write query", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Access denied"),
      );

      const tool = tools.find((t) => t.name === "mysql_write_query")!;
      const result = await tool.handler(
        { query: "INSERT INTO users VALUES (1)" },
        mockContext,
      );

      expect((result as Record<string, unknown>).success).toBe(false);
      expect((result as Record<string, unknown>).error).toContain(
        "Access denied",
      );
    });
  });

  describe("mysql_list_tables", () => {
    it("should call listTables adapter method", async () => {
      const tool = tools.find((t) => t.name === "mysql_list_tables")!;
      await tool.handler({}, mockContext);

      expect(mockAdapter.listTables).toHaveBeenCalled();
    });

    it("should return exists: false for nonexistent database", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = tools.find((t) => t.name === "mysql_list_tables")!;
      const result = await tool.handler({ database: "fake_db" }, mockContext);

      expect(result).toHaveProperty("exists", false);
      expect(result).toHaveProperty("database", "fake_db");
    });
  });

  describe("mysql_describe_table", () => {
    it("should call describeTable with table name", async () => {
      const tool = tools.find((t) => t.name === "mysql_describe_table")!;
      await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.describeTable).toHaveBeenCalledWith("users");
    });
  });

  describe("mysql_get_indexes", () => {
    it("should call getTableIndexes with table name", async () => {
      const tool = tools.find((t) => t.name === "mysql_get_indexes")!;
      await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.getTableIndexes).toHaveBeenCalledWith("users");
    });
  });

  describe("mysql_create_table", () => {
    it("should execute CREATE TABLE with columns", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      const result = await tool.handler(
        {
          name: "new_table",
          columns: [
            {
              name: "id",
              type: "INT",
              primaryKey: true,
              autoIncrement: true,
              nullable: false,
            },
            { name: "name", type: "VARCHAR(255)", nullable: true },
          ],
          engine: "InnoDB",
          charset: "utf8mb4",
          collate: "utf8mb4_unicode_ci",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("tableName", "new_table");
    });

    it("should handle column defaults correctly", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      await tool.handler(
        {
          name: "with_defaults",
          columns: [
            { name: "id", type: "INT", primaryKey: true },
            {
              name: "created_at",
              type: "TIMESTAMP",
              default: "CURRENT_TIMESTAMP",
            },
            { name: "status", type: "INT", default: 0 },
            { name: "label", type: "VARCHAR(50)", default: "pending" },
          ],
          engine: "InnoDB",
          charset: "utf8mb4",
          collate: "utf8mb4_unicode_ci",
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("CURRENT_TIMESTAMP");
    });

    it("should handle IF NOT EXISTS clause", async () => {
      mockAdapter.describeTable.mockResolvedValue({ columns: [] });
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      await tool.handler(
        {
          name: "test_table",
          columns: [{ name: "id", type: "INT" }],
          engine: "InnoDB",
          charset: "utf8mb4",
          collate: "utf8mb4_unicode_ci",
          ifNotExists: true,
        },
        mockContext,
      );

      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("IF NOT EXISTS");
    });

    it("should handle unique columns", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      await tool.handler(
        {
          name: "with_unique",
          columns: [
            { name: "id", type: "INT", primaryKey: true },
            { name: "email", type: "VARCHAR(255)", unique: true },
          ],
          engine: "InnoDB",
          charset: "utf8mb4",
          collate: "utf8mb4_unicode_ci",
        },
        mockContext,
      );

      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("UNIQUE");
    });

    it("should handle qualified table names", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      const result = await tool.handler(
        {
          name: "db.table",
          columns: [{ name: "id", type: "INT" }],
        },
        mockContext,
      );

      // First call should be USE statement
      const useCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(useCall).toBe("USE `db`");
      // Second call should be CREATE TABLE
      const sqlCall = mockAdapter.executeQuery.mock.calls[1]?.[0] as string;
      expect(sqlCall).toContain("`db`.`table`");
      expect(result).toHaveProperty("success", true);
    });

    it("should return graceful error when table already exists", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'test_table' already exists"),
      );

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      const result = await tool.handler(
        {
          name: "test_table",
          columns: [{ name: "id", type: "INT" }],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty(
        "error",
        "Table 'test_table' already exists",
      );
    });

    it("should return structured error for non-existence errors in create table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      const result = await tool.handler(
        {
          name: "test_table",
          columns: [{ name: "id", type: "INT" }],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toContain(
        "Access denied",
      );
    });

    it("should return skipped indicator when ifNotExists is true and table exists", async () => {
      mockAdapter.describeTable.mockResolvedValue({
        columns: [{ name: "id", type: "int" }],
      });

      const tool = tools.find((t) => t.name === "mysql_create_table")!;
      const result = await tool.handler(
        {
          name: "existing_table",
          columns: [{ name: "id", type: "INT" }],
          ifNotExists: true,
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("skipped", true);
      expect(result).toHaveProperty("reason", "Table already exists");
      // Should NOT call executeQuery since it short-circuits
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });
  });

  describe("mysql_drop_table", () => {
    it("should execute DROP TABLE", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_drop_table")!;
      const result = await tool.handler({ table: "old_table" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("DROP TABLE");
      expect(result).toHaveProperty("success", true);
    });

    it("should handle IF EXISTS clause", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_drop_table")!;
      await tool.handler({ table: "old_table", ifExists: true }, mockContext);

      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("IF EXISTS");
    });

    it("should return structured error for invalid table names", async () => {
      const tool = tools.find((t) => t.name === "mysql_drop_table")!;
      const result = await tool.handler({ table: "invalid-name" }, mockContext);

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toBe(
        "Invalid table name",
      );
    });

    it("should handle qualified table names", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });
      const tool = tools.find((t) => t.name === "mysql_drop_table")!;

      await tool.handler({ table: "db.table" }, mockContext);

      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("DROP TABLE IF EXISTS `db`.`table`");
    });

    it("should return graceful error when table does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Unknown table 'testdb.nonexistent'"),
      );

      const tool = tools.find((t) => t.name === "mysql_drop_table")!;
      const result = await tool.handler(
        { table: "nonexistent", ifExists: false },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty(
        "error",
        "Table 'nonexistent' does not exist",
      );
    });

    it("should return skipped indicator when ifExists is true and table absent", async () => {
      mockAdapter.describeTable.mockResolvedValue({ columns: [] });
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_drop_table")!;
      const result = await tool.handler(
        { table: "absent_table", ifExists: true },
        mockContext,
      );

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("skipped", true);
      expect(result).toHaveProperty("reason", "Table did not exist");
    });

    it("should return structured error for non-existence errors in drop table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = tools.find((t) => t.name === "mysql_drop_table")!;
      const result = await tool.handler(
        { table: "some_table", ifExists: false },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toContain(
        "Access denied",
      );
    });
  });

  describe("mysql_create_index", () => {
    it("should execute CREATE INDEX", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([]);
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_users_email",
          table: "users",
          columns: ["email"],
        },
        mockContext,
      );

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("indexName", "idx_users_email");
    });

    it("should create UNIQUE index", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([]);
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      await tool.handler(
        {
          name: "idx_unique",
          table: "users",
          columns: ["email"],
          unique: true,
        },
        mockContext,
      );

      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("UNIQUE");
    });

    it("should skip if index exists and ifNotExists is true", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([
        {
          name: "idx_existing",
          columns: ["col1"],
          type: "BTREE",
          unique: false,
        },
      ]);

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_existing",
          table: "users",
          columns: ["col1"],
          ifNotExists: true,
        },
        mockContext,
      );

      expect(result).toHaveProperty("skipped", true);
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });

    it("should return structured error for invalid index names", async () => {
      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "invalid-name",
          table: "users",
          columns: ["email"],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toBe(
        "Invalid index name",
      );
    });

    it("should return structured error for invalid table names", async () => {
      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "valid_name",
          table: "invalid-table",
          columns: ["email"],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toBe(
        "Invalid table name",
      );
    });

    it("should handle qualified table names", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([]);
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      await tool.handler(
        {
          name: "idx_test",
          table: "db.table",
          columns: ["id"],
        },
        mockContext,
      );

      const sqlCall = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
      expect(sqlCall).toContain("ON `db`.`table`");
    });

    it("should include warning when HASH type is requested", async () => {
      mockAdapter.getTableIndexes.mockResolvedValue([]);
      mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_hash",
          table: "users",
          columns: ["email"],
          type: "HASH",
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("warning");
      expect((result as Record<string, unknown>).warning).toContain("MEMORY");
    });

    it("should return graceful error when duplicate index name exists", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Duplicate key name 'idx_existing'"),
      );

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_existing",
          table: "users",
          columns: ["email"],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect(result).toHaveProperty(
        "error",
        "Index 'idx_existing' already exists on table 'users'",
      );
    });

    it("should return exists: false when table does not exist", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_test",
          table: "nonexistent",
          columns: ["col1"],
        },
        mockContext,
      );

      expect(result).toHaveProperty("exists", false);
      expect(result).toHaveProperty("table", "nonexistent");
    });

    it("should return structured error for non-index errors in create index", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_test",
          table: "users",
          columns: ["email"],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toContain(
        "Access denied",
      );
    });

    it("should return column-specific error for invalid column names", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Key column 'nonexistent_col' doesn't exist in table"),
      );

      const tool = tools.find((t) => t.name === "mysql_create_index")!;
      const result = await tool.handler(
        {
          name: "idx_test",
          table: "users",
          columns: ["nonexistent_col"],
        },
        mockContext,
      );

      expect(result).toHaveProperty("success", false);
      expect((result as Record<string, unknown>).error).toContain(
        "Column 'nonexistent_col' does not exist",
      );
      // Should NOT return exists: false (table exists, column doesn't)
      expect(result).not.toHaveProperty("exists", false);
    });
  });
});

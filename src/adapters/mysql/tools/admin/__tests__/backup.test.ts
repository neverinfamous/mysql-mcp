/**
 * mysql-mcp - Admin Backup Tools Unit Tests
 *
 * Comprehensive tests for backup.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createExportTableTool,
  createImportDataTool,
  createCreateDumpTool,
  createRestoreDumpTool,
} from "../backup.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Admin Backup Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createExportTableTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createExportTableTool(
        mockAdapter,
      );

      expect(tool.name).toBe("mysql_export_table");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should export table as SQL format", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, name: "Alice", email: "alice@example.com" },
            { id: 2, name: "Bob", email: "bob@example.com" },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL" },
        mockContext,
      )) as { data: { sql: string; rowCount: number } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledTimes(2);
      expect(result.data.sql).toContain("INSERT INTO `users`");
      expect(result.data.sql).toContain("Alice");
      expect(result.data.rowCount).toBe(2);
    });

    it("should export table as CSV format", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, name: "Alice", active: true },
            { id: 2, name: "Bob", active: false },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "CSV" },
        mockContext,
      )) as { data: { csv: string; rowCount: number } };

      expect(result.data.csv).toContain("id,name,active");
      expect(result.data.csv).toContain("Alice");
      expect(result.data.csv).toContain("Bob");
      expect(result.data.rowCount).toBe(2);
    });

    it("should export empty table", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ TABLE_NAME: "empty_table" }]),
        )
        .mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "empty_table", format: "SQL" },
        mockContext,
      )) as { data: { sql: string; rowCount: number } };

      expect(result.data.sql).toBe("");
      expect(result.data.rowCount).toBe(0);
    });

    it("should handle WHERE clause in SQL export", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ TABLE_NAME: "orders" }]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([{ id: 5, status: "active" }]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      await tool.handler(
        { table: "orders", format: "SQL", where: 'status = "active"' },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[1][0];
      expect(call).toContain('WHERE status = "active"');
    });

    it("should handle NULL values in SQL export", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ TABLE_NAME: "products" }]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([{ id: 1, name: "Test", description: null }]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "products", format: "SQL" },
        mockContext,
      )) as { data: { sql: string } };

      expect(result.data.sql).toContain("NULL");
    });

    it("should handle JSON values in SQL export", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "items" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, metadata: { key: "value", nested: { prop: 123 } } },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "items", format: "SQL" },
        mockContext,
      )) as { data: { sql: string } };

      expect(result.data.sql).toContain("metadata");
      expect(result.data.sql).toContain("key");
    });

    it("should handle object values in CSV export", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ TABLE_NAME: "configs" }]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([{ id: 1, config: { setting: "value" } }]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "configs", format: "CSV" },
        mockContext,
      )) as { data: { csv: string } };

      expect(result.data.csv).toContain("setting");
    });

    it("should validate table name for SQL injection", async () => {
      const tool = createExportTableTool(
        mockAdapter,
      );

      const result = (await tool.handler(
        { table: "users; DROP TABLE users;--", format: "SQL" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });

    it("should validate WHERE clause for SQL injection", async () => {
      const tool = createExportTableTool(
        mockAdapter,
      );

      const result = (await tool.handler(
        {
          table: "users",
          format: "SQL",
          where: "1=1; DELETE FROM users;--",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("dangerous SQL patterns");
    });

    it("should return structured error for non-existent table", async () => {
      // The first call is the existence check (P154)
      mockAdapter.executeReadQuery.mockResolvedValueOnce(
        createMockQueryResult([]),
      );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", format: "SQL" },
        mockContext,
      )) as { success: boolean; details: { exists: boolean }; error?: string };

      expect(result.success).toBe(false);
      expect(result.details?.exists).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return structured error for query failures", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]))
        .mockRejectedValueOnce(
          new Error("Unknown column 'invalid_col' in 'where clause'"),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL", where: "invalid_col = 'bad'" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown column");
    });

    it("should generate proper INSERT statements with column names", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "logs" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, email: "test@example.com", created_at: "2024-01-01" },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "logs", format: "SQL" },
        mockContext,
      )) as { data: { sql: string } };

      expect(result.data.sql).toContain("(`id`, `email`, `created_at`)");
      expect(result.data.sql).toContain("VALUES");
    });

    it("should return structured error for Zod validation failures", async () => {
      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", limit: -1 },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should return structured error for limit: 0", async () => {
      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", limit: 0 },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should batch rows into multi-row INSERT statements", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
            { id: 3, name: "Charlie" },
            { id: 4, name: "Diana" },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL", batch: 2 },
        mockContext,
      )) as { data: { sql: string; rowCount: number } };

      expect(result.data.rowCount).toBe(4);
      const statements = result.data.sql.split("\n");
      expect(statements).toHaveLength(2);
      // Each statement should have 2 value groups
      expect(statements[0]).toContain("VALUES (1, 'Alice'), (2, 'Bob')");
      expect(statements[1]).toContain("VALUES (3, 'Charlie'), (4, 'Diana')");
    });

    it("should handle batch larger than row count", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
            { id: 3, name: "Charlie" },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL", batch: 10 },
        mockContext,
      )) as { data: { sql: string; rowCount: number } };

      expect(result.data.rowCount).toBe(3);
      const statements = result.data.sql.split("\n");
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain(
        "VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')",
      );
    });

    it("should default to batch: 50 producing multi-row INSERT statements", async () => {
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ TABLE_NAME: "users" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([
            { id: 1, name: "Alice" },
            { id: 2, name: "Bob" },
          ]),
        );

      const tool = createExportTableTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL" },
        mockContext,
      )) as { data: { sql: string; rowCount: number } };

      expect(result.data.rowCount).toBe(2);
      const statements = result.data.sql.split("\n");
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain("VALUES (1, 'Alice'), (2, 'Bob');");
    });
  });

  describe("createImportDataTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createImportDataTool(mockAdapter);

      expect(tool.name).toBe("mysql_import_data");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("write");
      expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it("should import data rows", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = createImportDataTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [
            { name: "Alice", email: "alice@example.com" },
            { name: "Bob", email: "bob@example.com" },
          ],
        },
        mockContext,
      )) as { success: boolean; data: { rowsInserted: number } };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.data.rowsInserted).toBe(2);
    });

    it("should handle empty data array", async () => {
      const tool = createImportDataTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [],
        },
        mockContext,
      )) as { success: boolean; data: { rowsInserted: number } };

      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.data.rowsInserted).toBe(0);
    });

    it("should use parameterized queries", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = createImportDataTool(mockAdapter);
      await tool.handler(
        {
          table: "users",
          data: [{ name: "O'Brien", email: "obrien@example.com" }],
        },
        mockContext,
      );

      const call = mockAdapter.executeWriteQuery.mock.calls[0][0];
      expect(call).toContain("INSERT INTO");
      expect(call).toContain("?");
    });

    it("should validate table name for SQL injection", async () => {
      const tool = createImportDataTool(mockAdapter);

      const result = (await tool.handler(
        {
          table: "users; DROP TABLE users;--",
          data: [{ name: "test" }],
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid table name");
    });

    it("should handle various data types", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = createImportDataTool(mockAdapter);
      await tool.handler(
        {
          table: "mixed",
          data: [
            {
              str: "text",
              num: 42,
              bool: true,
              nul: null,
              obj: { key: "value" },
            },
          ],
        },
        mockContext,
      );

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
    });

    it("should return structured error for duplicate key violations", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Duplicate entry '1' for key 'users.PRIMARY'"),
      );

      const tool = createImportDataTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [
            { id: 1, name: "First" },
            { id: 1, name: "Duplicate" },
          ],
        },
        mockContext,
      )) as {
        success: boolean;
        error: string;
        details: { rowsInserted: number };
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Duplicate entry");
      expect(result.details.rowsInserted).toBe(0);
    });

    it("should return structured error for non-existent table", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createImportDataTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "nonexistent",
          data: [{ name: "test" }],
        },
        mockContext,
      )) as {
        success: boolean;
        error: string;
        details: { rowsInserted: number };
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("doesn't exist");
      expect(result.details.rowsInserted).toBe(0);
    });

    it("should return structured error for unknown column", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Unknown column 'nonexistent_col' in 'field list'"),
      );

      const tool = createImportDataTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [{ nonexistent_col: "test" }],
        },
        mockContext,
      )) as {
        success: boolean;
        error: string;
        details: { rowsInserted: number };
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown column");
      expect(result.details.rowsInserted).toBe(0);
    });

    it("should return structured error for Zod validation failures", async () => {
      const tool = createImportDataTool(mockAdapter);
      const result = (await tool.handler(
        { data: [{ name: "test" }] },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("createCreateDumpTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createCreateDumpTool(mockAdapter);

      expect(tool.name).toBe("mysql_create_dump");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should return validation error when database is missing", async () => {
      const tool = createCreateDumpTool(mockAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should generate mysqldump command with specific database", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ SCHEMA_NAME: "production_db" }]),
      );
      const tool = createCreateDumpTool(mockAdapter);
      const result = (await tool.handler(
        { database: "production_db" },
        mockContext,
      )) as { data: { command: string } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.data.command).toContain("production_db");
    });

    it("should include specific tables in command", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { SCHEMA_NAME: "mydb" },
          { TABLE_NAME: "users" },
        ]),
      );
      const tool = createCreateDumpTool(mockAdapter);
      const result = (await tool.handler(
        {
          database: "mydb",
          tables: ["users", "orders"],
        },
        mockContext,
      )) as { data: { command: string } };

      expect(result.data.command).toContain("users");
      expect(result.data.command).toContain("orders");
    });

    it("should add --no-data flag for schema-only dump", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ SCHEMA_NAME: "mydb" }]),
      );
      const tool = createCreateDumpTool(mockAdapter);
      const result = (await tool.handler(
        { database: "mydb", noData: true },
        mockContext,
      )) as { data: { command: string } };

      expect(result.data.command).toContain("--no-data");
    });

    it("should add --single-transaction flag when specified", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ SCHEMA_NAME: "mydb" }]),
      );
      const tool = createCreateDumpTool(mockAdapter);
      const result = (await tool.handler(
        { database: "mydb", singleTransaction: true },
        mockContext,
      )) as { data: { command: string } };

      expect(result.data.command).toContain("--single-transaction");
    });

    it("should combine multiple options", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { SCHEMA_NAME: "mydb" },
          { TABLE_NAME: "users" },
        ]),
      );
      const tool = createCreateDumpTool(mockAdapter);
      const result = (await tool.handler(
        {
          database: "mydb",
          tables: ["users"],
          noData: true,
          singleTransaction: true,
        },
        mockContext,
      )) as { data: { command: string } };

      expect(result.data.command).toContain("--no-data");
      expect(result.data.command).toContain("--single-transaction");
      expect(result.data.command).toContain("users");
    });
  });

  describe("createRestoreDumpTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createRestoreDumpTool(
        mockAdapter,
      );

      expect(tool.name).toBe("mysql_restore_dump");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it("should return validation error when database is missing", async () => {
      const tool = createRestoreDumpTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          filename: "backup.sql",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation error");
    });

    it("should generate mysql restore command with specific database", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ SCHEMA_NAME: "restore_target" }]),
      );
      const tool = createRestoreDumpTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          database: "restore_target",
          filename: "dump.sql",
        },
        mockContext,
      )) as { data: { command: string } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.data.command).toContain("restore_target");
      expect(result.data.command).toContain("dump.sql");
    });

    it("should handle various filename formats", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ SCHEMA_NAME: "mydb" }]),
      );
      const tool = createRestoreDumpTool(
        mockAdapter,
      );

      let result = (await tool.handler(
        { database: "mydb", filename: "/path/to/backup.sql" },
        mockContext,
      )) as { data: { command: string } };
      expect(result.data.command).toContain("/path/to/backup.sql");

      result = (await tool.handler(
        { database: "mydb", filename: "backup.sql.gz" },
        mockContext,
      )) as { data: { command: string } };
      expect(result.data.command).toContain("backup.sql.gz");
    });

    it("should return structured error for non-existent database", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));
      const tool = createRestoreDumpTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { database: "nonexistent", filename: "backup.sql" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });
  });
});

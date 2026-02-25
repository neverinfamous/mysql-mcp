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
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
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
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_export_table");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("read");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should export table as SQL format", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, name: "Alice", email: "alice@example.com" },
          { id: 2, name: "Bob", email: "bob@example.com" },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL" },
        mockContext,
      )) as { sql: string; rowCount: number };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.sql).toContain("INSERT INTO `users`");
      expect(result.sql).toContain("Alice");
      expect(result.rowCount).toBe(2);
    });

    it("should export table as CSV format", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, name: "Alice", active: true },
          { id: 2, name: "Bob", active: false },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "CSV" },
        mockContext,
      )) as { csv: string; rowCount: number };

      expect(result.csv).toContain("id,name,active");
      expect(result.csv).toContain("Alice");
      expect(result.csv).toContain("Bob");
      expect(result.rowCount).toBe(2);
    });

    it("should export empty table", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "empty_table", format: "SQL" },
        mockContext,
      )) as { sql: string; rowCount: number };

      expect(result.sql).toBe("");
      expect(result.rowCount).toBe(0);
    });

    it("should handle WHERE clause in SQL export", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 5, status: "active" }]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        { table: "orders", format: "SQL", where: 'status = "active"' },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain('WHERE status = "active"');
    });

    it("should handle NULL values in SQL export", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, name: "Test", description: null }]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "products", format: "SQL" },
        mockContext,
      )) as { sql: string };

      expect(result.sql).toContain("NULL");
    });

    it("should handle JSON values in SQL export", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, metadata: { key: "value", nested: { prop: 123 } } },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "items", format: "SQL" },
        mockContext,
      )) as { sql: string };

      expect(result.sql).toContain("metadata");
      expect(result.sql).toContain("key");
    });

    it("should handle object values in CSV export", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, config: { setting: "value" } }]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "configs", format: "CSV" },
        mockContext,
      )) as { csv: string };

      expect(result.csv).toContain("setting");
    });

    it("should validate table name for SQL injection", async () => {
      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
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
        mockAdapter as unknown as MySQLAdapter,
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

    it("should return exists: false for non-existent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", format: "SQL" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });

    it("should return structured error for query failures", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown column 'invalid_col' in 'where clause'"),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL", where: "invalid_col = 'bad'" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown column");
    });

    it("should generate proper INSERT statements with column names", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, email: "test@example.com", created_at: "2024-01-01" },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "logs", format: "SQL" },
        mockContext,
      )) as { sql: string };

      expect(result.sql).toContain("(`id`, `email`, `created_at`)");
      expect(result.sql).toContain("VALUES");
    });

    it("should return structured error for Zod validation failures", async () => {
      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
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
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", limit: 0 },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should batch rows into multi-row INSERT statements", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Charlie" },
          { id: 4, name: "Diana" },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL", batch: 2 },
        mockContext,
      )) as { sql: string; rowCount: number };

      expect(result.rowCount).toBe(4);
      const statements = result.sql.split("\n");
      expect(statements).toHaveLength(2);
      // Each statement should have 2 value groups
      expect(statements[0]).toContain("VALUES (1, 'Alice'), (2, 'Bob')");
      expect(statements[1]).toContain("VALUES (3, 'Charlie'), (4, 'Diana')");
    });

    it("should handle batch larger than row count", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
          { id: 3, name: "Charlie" },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL", batch: 10 },
        mockContext,
      )) as { sql: string; rowCount: number };

      expect(result.rowCount).toBe(3);
      const statements = result.sql.split("\n");
      expect(statements).toHaveLength(1);
      expect(statements[0]).toContain(
        "VALUES (1, 'Alice'), (2, 'Bob'), (3, 'Charlie')",
      );
    });

    it("should default to batch: 1 producing individual INSERT statements", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ]),
      );

      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", format: "SQL" },
        mockContext,
      )) as { sql: string; rowCount: number };

      expect(result.rowCount).toBe(2);
      const statements = result.sql.split("\n");
      expect(statements).toHaveLength(2);
      expect(statements[0]).toContain("VALUES (1, 'Alice');");
      expect(statements[1]).toContain("VALUES (2, 'Bob');");
    });
  });

  describe("createImportDataTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);

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

      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [
            { name: "Alice", email: "alice@example.com" },
            { name: "Bob", email: "bob@example.com" },
          ],
        },
        mockContext,
      )) as { success: boolean; rowsInserted: number };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.rowsInserted).toBe(2);
    });

    it("should handle empty data array", async () => {
      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [],
        },
        mockContext,
      )) as { success: boolean; rowsInserted: number };

      expect(mockAdapter.executeWriteQuery).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.rowsInserted).toBe(0);
    });

    it("should use parameterized queries", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "users",
          data: [{ name: "O'Brien", email: "obrien@example.com" }],
        },
        mockContext,
      );

      const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
      expect(call).toContain("INSERT INTO");
      expect(call).toContain("?");
    });

    it("should validate table name for SQL injection", async () => {
      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);

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

      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
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
      mockAdapter.executeWriteQuery
        .mockResolvedValueOnce({
          rows: [],
          rowsAffected: 1,
          executionTimeMs: 5,
        })
        .mockRejectedValueOnce(
          new Error("Duplicate entry '1' for key 'users.PRIMARY'"),
        );

      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [
            { id: 1, name: "First" },
            { id: 1, name: "Duplicate" },
          ],
        },
        mockContext,
      )) as { success: boolean; error: string; rowsInserted: number };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Duplicate entry");
      expect(result.rowsInserted).toBe(1);
    });

    it("should return exists: false for non-existent table", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "nonexistent",
          data: [{ name: "test" }],
        },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });

    it("should return structured error for unknown column", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(
        new Error("Unknown column 'nonexistent_col' in 'field list'"),
      );

      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "users",
          data: [{ nonexistent_col: "test" }],
        },
        mockContext,
      )) as { success: boolean; error: string; rowsInserted: number };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown column");
      expect(result.rowsInserted).toBe(0);
    });

    it("should return structured error for Zod validation failures", async () => {
      const tool = createImportDataTool(mockAdapter as unknown as MySQLAdapter);
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
      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);

      expect(tool.name).toBe("mysql_create_dump");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it("should generate mysqldump command for current database", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "testdb" }]),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        command: string;
        note: string;
      };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "SELECT DATABASE() as db",
      );
      expect(result.command).toContain("mysqldump");
      expect(result.command).toContain("testdb");
      expect(result.note).toBeDefined();
    });

    it("should generate mysqldump command with specific database", async () => {
      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { database: "production_db" },
        mockContext,
      )) as { command: string };

      expect(mockAdapter.executeReadQuery).not.toHaveBeenCalled();
      expect(result.command).toContain("production_db");
    });

    it("should include specific tables in command", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "mydb" }]),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          tables: ["users", "orders"],
        },
        mockContext,
      )) as { command: string };

      expect(result.command).toContain("users");
      expect(result.command).toContain("orders");
    });

    it("should add --no-data flag for schema-only dump", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "mydb" }]),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({ noData: true }, mockContext)) as {
        command: string;
      };

      expect(result.command).toContain("--no-data");
    });

    it("should add --single-transaction flag when specified", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "mydb" }]),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { singleTransaction: true },
        mockContext,
      )) as { command: string };

      expect(result.command).toContain("--single-transaction");
    });

    it("should combine multiple options", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "mydb" }]),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          tables: ["users"],
          noData: true,
          singleTransaction: true,
        },
        mockContext,
      )) as { command: string };

      expect(result.command).toContain("--no-data");
      expect(result.command).toContain("--single-transaction");
      expect(result.command).toContain("users");
    });

    it("should handle missing database gracefully", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: null }]),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        command: string;
      };

      expect(result.command).toBeDefined();
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Connection lost"),
      );

      const tool = createCreateDumpTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler({}, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection lost");
    });
  });

  describe("createRestoreDumpTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createRestoreDumpTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      expect(tool.name).toBe("mysql_restore_dump");
      expect(tool.group).toBe("backup");
      expect(tool.requiredScopes).toContain("admin");
      expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it("should generate mysql restore command for current database", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "testdb" }]),
      );

      const tool = createRestoreDumpTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          filename: "backup.sql",
        },
        mockContext,
      )) as { command: string; note: string };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        "SELECT DATABASE() as db",
      );
      expect(result.command).toContain("mysql");
      expect(result.command).toContain("testdb");
      expect(result.command).toContain("backup.sql");
      expect(result.note).toBeDefined();
    });

    it("should generate mysql restore command with specific database", async () => {
      const tool = createRestoreDumpTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          database: "restore_target",
          filename: "dump.sql",
        },
        mockContext,
      )) as { command: string };

      expect(mockAdapter.executeReadQuery).not.toHaveBeenCalled();
      expect(result.command).toContain("restore_target");
      expect(result.command).toContain("dump.sql");
    });

    it("should handle various filename formats", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: "mydb" }]),
      );

      const tool = createRestoreDumpTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      let result = (await tool.handler(
        { filename: "/path/to/backup.sql" },
        mockContext,
      )) as { command: string };
      expect(result.command).toContain("/path/to/backup.sql");

      result = (await tool.handler(
        { filename: "backup.sql.gz" },
        mockContext,
      )) as { command: string };
      expect(result.command).toContain("backup.sql.gz");
    });

    it("should handle missing database gracefully", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ db: null }]),
      );

      const tool = createRestoreDumpTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      )) as { command: string };

      expect(result.command).toBeDefined();
    });

    it("should return structured error on query failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Connection lost"),
      );

      const tool = createRestoreDumpTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { filename: "backup.sql" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection lost");
    });
  });
});

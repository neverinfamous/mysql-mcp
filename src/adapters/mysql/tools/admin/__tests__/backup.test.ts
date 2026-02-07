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

      await expect(
        tool.handler(
          { table: "users; DROP TABLE users;--", format: "SQL" },
          mockContext,
        ),
      ).rejects.toThrow();
    });

    it("should validate WHERE clause for SQL injection", async () => {
      const tool = createExportTableTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      await expect(
        tool.handler(
          {
            table: "users",
            format: "SQL",
            where: "1=1; DELETE FROM users;--",
          },
          mockContext,
        ),
      ).rejects.toThrow();
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

      await expect(
        tool.handler(
          {
            table: "users; DROP TABLE users;--",
            data: [{ name: "test" }],
          },
          mockContext,
        ),
      ).rejects.toThrow();
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
  });
});

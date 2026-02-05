/**
 * Security Injection Tests
 *
 * Tests that verify SQL injection prevention across tool handlers.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import { getBackupTools } from "../admin/index.js";
import { getJsonTools } from "../json/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";

describe("Security: SQL Injection Prevention", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("Backup Tools - mysql_export_table", () => {
    it("should reject table name with SQL injection", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "users; DROP TABLE users",
            format: "SQL",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject table name starting with number", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "123users",
            format: "SQL",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject WHERE clause with stacked queries", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "users",
            format: "SQL",
            where: "1=1; DROP TABLE users",
          },
          mockContext,
        ),
      ).rejects.toThrow("dangerous SQL patterns");
    });

    it("should reject WHERE clause with UNION attack", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "users",
            format: "SQL",
            where: "1=1 UNION SELECT password FROM admin",
          },
          mockContext,
        ),
      ).rejects.toThrow("dangerous SQL patterns");
    });

    it("should reject WHERE clause with timing attack (SLEEP)", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "users",
            format: "SQL",
            where: "1=1 AND SLEEP(5)",
          },
          mockContext,
        ),
      ).rejects.toThrow("dangerous SQL patterns");
    });

    it("should reject WHERE clause with unbalanced quotes", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "users",
            format: "SQL",
            where: "id = 1 OR '1'='1",
          },
          mockContext,
        ),
      ).rejects.toThrow("unbalanced");
    });

    it("should accept valid table and WHERE", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue({ rows: [] });

      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const exportTool = tools.find((t) => t.name === "mysql_export_table")!;

      await expect(
        exportTool.handler(
          {
            table: "users",
            format: "SQL",
            where: "status = 'active' AND created_at > '2024-01-01'",
          },
          mockContext,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe("Backup Tools - mysql_import_data", () => {
    it("should reject table name with injection", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const importTool = tools.find((t) => t.name === "mysql_import_data")!;

      await expect(
        importTool.handler(
          {
            table: "users`; DROP TABLE users; --",
            data: [{ id: 1, name: "test" }],
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject column name with injection", async () => {
      const tools = getBackupTools(mockAdapter as unknown as MySQLAdapter);
      const importTool = tools.find((t) => t.name === "mysql_import_data")!;

      await expect(
        importTool.handler(
          {
            table: "users",
            data: [{ "id; DROP TABLE": 1 }],
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid column name");
    });
  });

  describe("JSON Tools - Injection Prevention", () => {
    it("should reject table name with injection in mysql_json_extract", async () => {
      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const extractTool = tools.find((t) => t.name === "mysql_json_extract")!;

      await expect(
        extractTool.handler(
          {
            table: "users'; DROP TABLE users; --",
            column: "data",
            path: "$.name",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid table name");
    });

    it("should reject column name with injection in mysql_json_extract", async () => {
      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const extractTool = tools.find((t) => t.name === "mysql_json_extract")!;

      await expect(
        extractTool.handler(
          {
            table: "users",
            column: "data`; DELETE FROM users; --",
            path: "$.name",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid column name");
    });

    it("should reject WHERE clause with BENCHMARK attack in mysql_json_set", async () => {
      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const setTool = tools.find((t) => t.name === "mysql_json_set")!;

      await expect(
        setTool.handler(
          {
            table: "users",
            column: "data",
            path: "$.name",
            value: "test",
            where: "id = 1 AND BENCHMARK(1000000, SHA1('test'))",
          },
          mockContext,
        ),
      ).rejects.toThrow("dangerous SQL patterns");
    });

    it("should reject WHERE clause with file operation attack", async () => {
      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const setTool = tools.find((t) => t.name === "mysql_json_set")!;

      await expect(
        setTool.handler(
          {
            table: "users",
            column: "data",
            path: "$.name",
            value: "test",
            where: "id = 1 INTO OUTFILE '/tmp/pwned'",
          },
          mockContext,
        ),
      ).rejects.toThrow("dangerous SQL patterns");
    });

    it("should accept valid inputs in mysql_json_set", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1 });

      const tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
      const setTool = tools.find((t) => t.name === "mysql_json_set")!;

      await expect(
        setTool.handler(
          {
            table: "users",
            column: "preferences",
            path: "$.theme",
            value: '"dark"',
            where: "id = 123",
          },
          mockContext,
        ),
      ).resolves.toBeDefined();
    });
  });
});

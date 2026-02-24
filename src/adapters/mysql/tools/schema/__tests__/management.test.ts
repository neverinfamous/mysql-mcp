import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createListSchemasTool,
  createCreateSchemaTool,
  createDropSchemaTool,
} from "../management.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema Management Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("mysql_list_schemas", () => {
    it("should list and filter schemas", async () => {
      const tool = createListSchemasTool(
        mockAdapter as unknown as MySQLAdapter,
      );

      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { name: "db1", charset: "utf8", collation: "utf8_bin" },
          { name: "db2", charset: "utf8mb4", collation: "utf8mb4_unicode_ci" },
        ]),
      );

      const result = await tool.handler({ pattern: "db%" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("LIKE ?"),
        ["db%"],
      );
      expect(result).toHaveProperty("schemas");
      expect(result).toHaveProperty("count", 2);
    });

    it("should list all schemas if no pattern provided", async () => {
      const tool = createListSchemasTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.not.stringContaining("LIKE ?"),
        [],
      );
    });
  });

  describe("mysql_create_schema", () => {
    it("should create schema with default settings", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      // Pre-check returns no rows (schema doesn't exist)
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
      // CREATE DATABASE succeeds
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const result = await tool.handler({ name: "new_db" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const sql = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(sql).toContain("CREATE DATABASE IF NOT EXISTS `new_db`");
      expect(sql).toContain("utf8mb4"); // defaults
      expect(result).toHaveProperty("success", true);
    });

    it("should return structured error for invalid schema names", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { name: "invalid-name" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid schema name");
    });

    it("should return structured error for invalid charset", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { name: "valid_db", charset: "bad; DROP DATABASE" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid charset");
    });

    it("should return structured error for invalid collation", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { name: "valid_db", collation: "bad; DROP DATABASE" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid collation");
    });

    it("should use custom charset and collation", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      await tool.handler(
        {
          name: "custom_db",
          charset: "latin1",
          collation: "latin1_swedish_ci",
          ifNotExists: false,
        },
        mockContext,
      );

      const sql = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(sql).toContain("CREATE DATABASE `custom_db`"); // no IF NOT EXISTS
      expect(sql).toContain("latin1");
      expect(sql).toContain("latin1_swedish_ci");
    });

    it("should return success false when schema already exists", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Can't create database 'existing_db'; database exists"),
      );

      const result = (await tool.handler(
        { name: "existing_db", ifNotExists: false },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("already exists");
    });

    it("should return skipped when schema already exists with ifNotExists", async () => {
      const tool = createCreateSchemaTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      // Pre-check finds existing schema
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "existing_db" }]),
      );

      const result = (await tool.handler(
        { name: "existing_db", ifNotExists: true },
        mockContext,
      )) as {
        success: boolean;
        skipped: boolean;
        reason: string;
        schemaName: string;
      };

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("Schema already exists");
      expect(result.schemaName).toBe("existing_db");
      // Only the pre-check query should have been called
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("mysql_drop_schema", () => {
    it("should drop schema with IF EXISTS by default", async () => {
      const tool = createDropSchemaTool(mockAdapter as unknown as MySQLAdapter);
      // Pre-check returns schema exists
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "old_db" }]),
      );
      // DROP DATABASE succeeds
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const result = await tool.handler({ name: "old_db" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const sql = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(sql).toContain("DROP DATABASE IF EXISTS `old_db`");
      expect(result).toHaveProperty("success", true);
    });

    it("should return structured error for system schemas", async () => {
      const tool = createDropSchemaTool(mockAdapter as unknown as MySQLAdapter);

      for (const name of [
        "mysql",
        "information_schema",
        "performance_schema",
        "sys",
      ]) {
        const result = (await tool.handler({ name }, mockContext)) as {
          success: boolean;
          error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toBe("Cannot drop system schema");
      }
    });

    it("should return structured error for invalid schema names", async () => {
      const tool = createDropSchemaTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { name: "invalid-db" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid schema name");
    });

    it("should drop schema without IF EXISTS if requested", async () => {
      const tool = createDropSchemaTool(mockAdapter as unknown as MySQLAdapter);
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      await tool.handler({ name: "db", ifExists: false }, mockContext);

      const sql = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(sql).toBe("DROP DATABASE `db`");
    });

    it("should return success false when schema does not exist", async () => {
      const tool = createDropSchemaTool(mockAdapter as unknown as MySQLAdapter);
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Can't drop database 'gone_db'; database doesn't exist"),
      );

      const result = (await tool.handler(
        { name: "gone_db", ifExists: false },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("does not exist");
    });

    it("should return skipped when schema does not exist with ifExists", async () => {
      const tool = createDropSchemaTool(mockAdapter as unknown as MySQLAdapter);
      // Pre-check finds no schema
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const result = (await tool.handler(
        { name: "gone_db", ifExists: true },
        mockContext,
      )) as {
        success: boolean;
        skipped: boolean;
        reason: string;
        schemaName: string;
      };

      expect(result.success).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("Schema did not exist");
      expect(result.schemaName).toBe("gone_db");
      // Only the pre-check query should have been called
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });
  });
});

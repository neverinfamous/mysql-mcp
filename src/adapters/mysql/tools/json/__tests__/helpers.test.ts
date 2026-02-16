/**
 * mysql-mcp - JSON Helper Tools Unit Tests
 *
 * Comprehensive tests for helpers.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createJsonGetTool,
  createJsonUpdateTool,
  createJsonSearchTool,
  createJsonValidateTool,
} from "../helpers.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("JSON Helper Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createJsonGetTool", () => {
    it("should get JSON value by ID", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ value: '{"a":1}' }]),
      );

      const tool = createJsonGetTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          id: 1,
        },
        mockContext,
      )) as { value: any };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_EXTRACT");
      expect(call).toContain("WHERE `id` = ?");
      // Value is parsed from JSON string
      expect(result.value).toEqual({ a: 1 });
    });
  });

  describe("createJsonSearchTool", () => {
    it("should search JSON by value", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, match_path: "$[0]" }]),
      );

      const tool = createJsonSearchTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "data",
          column: "json_col",
          searchValue: "test",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_SEARCH");
      expect(call).toContain("SELECT id, `json_col`");
      expect(call).not.toContain("SELECT *");
    });
  });

  describe("createJsonUpdateTool", () => {
    it("should update JSON value by ID", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rowsAffected: 1,
        insertId: 0,
      });

      const tool = createJsonUpdateTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          value: 2,
          id: 1,
        },
        mockContext,
      )) as { success: boolean };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should return reason when no row matches the ID", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rowsAffected: 0,
        insertId: 0,
      });

      const tool = createJsonUpdateTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          value: 2,
          id: 999,
        },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("999");
    });
  });

  describe("createJsonValidateTool", () => {
    it("should validate JSON string", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 1 }]),
      );

      const tool = createJsonValidateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          value: '{"a":1}',
        },
        mockContext,
      )) as { valid: boolean };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });

    it("should auto-convert bare strings and mark autoConverted", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 1 }]),
      );

      const tool = createJsonValidateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          value: "hello",
        },
        mockContext,
      )) as { valid: boolean; autoConverted: boolean };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      // The bare string "hello" should be auto-wrapped to "\"hello\"" before SQL
      const sqlParam = mockAdapter.executeReadQuery.mock
        .calls[0][1] as string[];
      expect(sqlParam[0]).toBe('"hello"');
      expect(result.valid).toBe(true);
      expect(result.autoConverted).toBe(true);
    });
  });

  describe("P154 Graceful Error Handling", () => {
    const tableError = new Error("Table 'testdb.nonexistent' doesn't exist");

    it("json_get should return exists: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(tableError);
      const tool = createJsonGetTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { table: "nonexistent", column: "doc", path: "$.x", id: 1 },
        mockContext,
      );
      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("json_update should return exists: false for nonexistent table", async () => {
      mockAdapter.executeWriteQuery.mockRejectedValue(tableError);
      const tool = createJsonUpdateTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { table: "nonexistent", column: "doc", path: "$.x", value: 1, id: 1 },
        mockContext,
      );
      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("json_search should return exists: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(tableError);
      const tool = createJsonSearchTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { table: "nonexistent", column: "doc", searchValue: "test" },
        mockContext,
      );
      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("should return success: false for generic errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Connection lost"),
      );
      const tool = createJsonGetTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { table: "data", column: "doc", path: "$.x", id: 1 },
        mockContext,
      );
      expect(result).toEqual({ success: false, error: "Connection lost" });
    });
  });
});

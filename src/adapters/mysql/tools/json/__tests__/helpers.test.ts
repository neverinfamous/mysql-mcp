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
import type {} from "../../../mysql-adapter/index.js";
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
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(createMockQueryResult([{ is_valid: 1 }]))
        .mockResolvedValueOnce(createMockQueryResult([{ value: '{"a":1}' }]));

      const tool = createJsonGetTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          where: "`id` = 1",
        },
        mockContext,
      )) as { data: { value: any } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledTimes(2);
      const call1 = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call1).toContain("JSON_VALID");
      
      const call2 = mockAdapter.executeReadQuery.mock.calls[1][0];
      expect(call2).toContain("JSON_EXTRACT");
      expect(call2).toContain("WHERE `id` = 1");
      // Value is parsed from JSON string
      expect(result.data.value).toEqual({ a: 1 });
    });

    it("should return rowFound: false for nonexistent row", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createJsonGetTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          where: "`id` = 999",
        },
        mockContext,
      )) as { data: { value: null; rowFound: boolean } };

      expect(result.data.value).toBeNull();
      expect(result.data.rowFound).toBe(false);
    });
  });

  describe("createJsonSearchTool", () => {
    it("should search JSON by value", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, match_path: "$[0]" }]),
      );

      const tool = createJsonSearchTool(mockAdapter);
      await tool.handler(
        {
          table: "data",
          column: "json_col",
          searchValue: "test",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("JSON_SEARCH");
      expect(call).toContain("SELECT *, CASE WHEN JSON_VALID");
      expect(call).not.toContain("SELECT id, `json_col`, JSON_SEARCH");
    });
  });

  describe("createJsonUpdateTool", () => {
    it("should update JSON value by ID", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rowsAffected: 1,
        insertId: 0,
      });

      const tool = createJsonUpdateTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          value: 2,
          where: "`id` = 1",
        },
        mockContext,
      )) as { data: { rowsAffected: number } };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      expect(result.data.rowsAffected).toBe(1);
    });

    it("should return reason when no row matches the ID", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rowsAffected: 0,
        insertId: 0,
      });
      mockAdapter.executeReadQuery.mockResolvedValue({ rows: [] });

      const tool = createJsonUpdateTool(mockAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          path: "$.a",
          value: 2,
          where: "`id` = 999",
        },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("999");
    });
  });

  describe("createJsonValidateTool", () => {
    it("should validate JSON string", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 1 }]),
      );

      const tool = createJsonValidateTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          value: '{"a":1}',
        },
        mockContext,
      )) as { data: { valid: boolean } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.data.valid).toBe(true);
    });

    it("should pass bare strings directly without auto-conversion", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 0 }]),
      );

      const tool = createJsonValidateTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          value: "hello",
        },
        mockContext,
      )) as { data: { valid: boolean } };

      expect(mockAdapter.executeReadQuery).not.toHaveBeenCalled();
      expect(result.data.valid).toBe(false);
    });

    it("should return valid: false for Invalid JSON text query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error(
          'Query failed: Execute failed: Invalid JSON text in argument 1 to function cast_as_json: "Missing a name" at position 1.',
        ),
      );

      const tool = createJsonValidateTool(
        mockAdapter,
      );
      const result = (await tool.handler({ value: "{bad" }, mockContext)) as {
        success: boolean;
        data?: { valid: boolean };
      };

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
    });

    it("should strip Query failed and Execute failed prefixes from generic errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Query failed: Execute failed: Table metadata lock timeout."),
      );

      const tool = createJsonValidateTool(
        mockAdapter,
      );
      const result = (await tool.handler({ value: '{"good": 1}' }, mockContext)) as {
        success: boolean;
        error: string;
      };

      expect(result.success).toBe(false);
      expect(result.error).not.toContain("Query failed");
      expect(result.error).not.toContain("Execute failed");
      expect(result.error).toContain("Table metadata lock timeout");
    });
  });

  describe("P154 Graceful Error Handling", () => {
    const tableError = new Error("Table 'testdb.nonexistent' does not exist");

    const errorTests = [
      { name: "json_get", toolFn: createJsonGetTool, readQuery: true, args: { table: "nonexistent", column: "doc", path: "$.x", where: "`id` = 1" } },
      { name: "json_update", toolFn: createJsonUpdateTool, readQuery: false, args: { table: "nonexistent", column: "doc", path: "$.x", value: 1, where: "`id` = 1" } },
      { name: "json_search", toolFn: createJsonSearchTool, readQuery: true, args: { table: "nonexistent", column: "doc", searchValue: "test" } }
    ];

    errorTests.forEach(({ name, toolFn, readQuery, args }) => {
      it(`${name} should return exists: false for nonexistent table`, async () => {
        if (readQuery) {
          mockAdapter.executeReadQuery.mockRejectedValue(tableError);
        } else {
          mockAdapter.executeWriteQuery.mockRejectedValue(tableError);
        }
        const tool = toolFn(mockAdapter);
        const result = await tool.handler(args as any, mockContext);
        expect(result.success).toBe(false);
        expect((result as any).error).toContain("Table 'testdb.nonexistent' does not exist");
      });
    });

    it("should return success: false for generic errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Connection lost"),
      );
      const tool = createJsonGetTool(mockAdapter);
      const result = await tool.handler(
        { table: "data", column: "doc", path: "$.x", where: "`id` = 1" },
        mockContext,
      );
      expect(result.success).toBe(false);
      expect((result as any).error).toContain("Connection lost");
    });
  });
});

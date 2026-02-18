/**
 * mysql-mcp - JSON Helper Tools Unit Tests
 *
 * Tests for JSON helper tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getJsonHelperTools } from "../json/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

describe("getJsonHelperTools", () => {
  let tools: ReturnType<typeof getJsonHelperTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getJsonHelperTools(
      createMockMySQLAdapter() as unknown as MySQLAdapter,
    );
  });

  it("should return 4 helper tools", () => {
    expect(tools).toHaveLength(4);
  });

  it("should include get, update, search, validate tools", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("mysql_json_get");
    expect(toolNames).toContain("mysql_json_update");
    expect(toolNames).toContain("mysql_json_search");
    expect(toolNames).toContain("mysql_json_validate");
  });
});

describe("JSON Helper Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getJsonHelperTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getJsonHelperTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_json_search", () => {
    it("should search within JSON", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, path: "$.name" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_search")!;
      await tool.handler(
        {
          table: "users",
          column: "metadata",
          searchValue: "test",
          mode: "all",
        },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_SEARCH");
    });
  });

  describe("mysql_json_validate", () => {
    it("should validate valid JSON", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 1 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_validate")!;
      const result = (await tool.handler(
        { value: '{"name":"test"}' },
        mockContext,
      )) as { valid: boolean };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.valid).toBe(true);
    });

    it("should return valid: false for malformed JSON", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 0 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_validate")!;
      const result = (await tool.handler(
        { value: '{"broken": true' },
        mockContext,
      )) as { valid: boolean };

      expect(result.valid).toBe(false);
    });

    it("should return valid: false for bare strings", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ is_valid: 0 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_validate")!;
      const result = (await tool.handler({ value: "hello" }, mockContext)) as {
        valid: boolean;
      };

      expect(result.valid).toBe(false);
    });

    it("should return structured error on MySQL failure", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Validation query failed"),
      );

      const tool = tools.find((t) => t.name === "mysql_json_validate")!;
      const result = (await tool.handler(
        { value: "\x00invalid" },
        mockContext,
      )) as { valid: boolean; error: string };

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Validation query failed");
    });
  });

  describe("mysql_json_get", () => {
    it("should extract JSON value by row ID", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ value: "John Doe" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_get")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.name",
          id: 1,
        },
        mockContext,
      )) as { value: string };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      // Uses JSON_EXTRACT, parses result
      expect(call).toContain("JSON_EXTRACT");
      // Raw string values are returned as-is after JSON parse attempt
      expect(result.value).toBe("John Doe");
    });

    it("should use custom ID column", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ value: "test" }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_get")!;
      await tool.handler(
        {
          table: "products",
          column: "specs",
          path: "$.weight",
          id: "ABC123",
          idColumn: "sku",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("`sku`");
    });
  });

  describe("mysql_json_update", () => {
    it("should update JSON value by row ID", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_update")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.name",
          value: "Jane Doe",
          id: 1,
        },
        mockContext,
      )) as { success: boolean };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should return failure when no rows updated", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 0,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_update")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.name",
          value: "Jane Doe",
          id: 999,
        },
        mockContext,
      )) as { success: boolean };

      expect(result.success).toBe(false);
    });
  });
});

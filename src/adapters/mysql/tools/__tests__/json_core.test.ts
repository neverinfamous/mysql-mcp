/**
 * mysql-mcp - JSON Core Tools Unit Tests
 *
 * Tests for JSON core tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getJsonTools } from "../json/index.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";

describe("getJsonTools", () => {
  let tools: ReturnType<typeof getJsonTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    tools = getJsonTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
  });

  it("should return 8 JSON tools", () => {
    expect(tools).toHaveLength(8);
  });

  it("should include all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("mysql_json_extract");
    expect(toolNames).toContain("mysql_json_set");
    expect(toolNames).toContain("mysql_json_insert");
    expect(toolNames).toContain("mysql_json_replace");
    expect(toolNames).toContain("mysql_json_remove");
    expect(toolNames).toContain("mysql_json_contains");
    expect(toolNames).toContain("mysql_json_keys");
    expect(toolNames).toContain("mysql_json_array_append");
  });

  it("should have json group for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("json");
    }
  });

  it("should have handler functions for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("mysql_json_extract should be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_json_extract")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("mysql_json_set should not be read-only", () => {
    const tool = tools.find((t) => t.name === "mysql_json_set")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });
});

describe("JSON Core Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tools: ReturnType<typeof getJsonTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tools = getJsonTools(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  describe("mysql_json_extract", () => {
    it("should execute JSON_EXTRACT query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ result: '"value"' }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_extract")!;
      await tool.handler(
        { table: "users", column: "metadata", path: "$.name" },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_EXTRACT");
    });

    it("should include WHERE clause if provided", async () => {
      const tool = tools.find((t) => t.name === "mysql_json_extract")!;
      mockAdapter.executeReadQuery.mockResolvedValueOnce(
        createMockQueryResult([]),
      );

      await tool.handler(
        {
          table: "users",
          column: "data",
          path: "$.name",
          where: "id > 5",
        },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining("WHERE id > 5"),
        ["$.name"],
      );
    });
  });

  describe("mysql_json_contains", () => {
    it("should check JSON containment", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1 }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_contains")!;
      await tool.handler(
        {
          table: "users",
          column: "metadata",
          value: { key: "value" },
        },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_CONTAINS");
    });

    it("should use 2-arg JSON_CONTAINS if path not provided", async () => {
      const tool = tools.find((t) => t.name === "mysql_json_contains")!;
      mockAdapter.executeReadQuery.mockResolvedValueOnce(
        createMockQueryResult([]),
      );

      await tool.handler(
        {
          table: "users",
          column: "data",
          value: { role: "admin" },
        },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining("JSON_CONTAINS(`data`, ?)"),
        [JSON.stringify({ role: "admin" })],
      );
    });

    it("should use 3-arg JSON_CONTAINS if path provided", async () => {
      const tool = tools.find((t) => t.name === "mysql_json_contains")!;
      mockAdapter.executeReadQuery.mockResolvedValueOnce(
        createMockQueryResult([]),
      );

      await tool.handler(
        {
          table: "users",
          column: "data",
          value: '"admin"',
          path: "$.role",
        },
        mockContext,
      );

      expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
        expect.stringContaining("JSON_CONTAINS(`data`, ?, ?)"),
        [JSON.stringify("admin"), "$.role"],
      );
    });
  });

  describe("mysql_json_keys", () => {
    it("should get JSON keys", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ keys: '["name", "email"]' }]),
      );

      const tool = tools.find((t) => t.name === "mysql_json_keys")!;
      await tool.handler({ table: "users", column: "metadata" }, mockContext);

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_KEYS");
    });
  });

  describe("mysql_json_set", () => {
    it("should update JSON value at path", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_set")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.name",
          value: '"John"',
          where: "id = 1",
        },
        mockContext,
      )) as { rowsAffected: number };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_SET");
      expect(result.rowsAffected).toBe(1);
    });

    it("should handle object values", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_set")!;
      await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.address",
          value: { city: "NYC", zip: "10001" },
          where: "id = 1",
        },
        mockContext,
      );

      const params = mockAdapter.executeWriteQuery.mock.calls[0][1] as string[];
      expect(params[1]).toContain("city");
    });
  });

  describe("mysql_json_insert", () => {
    it("should insert JSON value only if path does not exist", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_insert")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.nickname",
          value: '"johndoe"',
          where: "id = 1",
        },
        mockContext,
      )) as { rowsAffected: number };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_INSERT");
      expect(result.rowsAffected).toBe(1);
    });
  });

  describe("mysql_json_replace", () => {
    it("should replace JSON value only if path exists", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_replace")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          path: "$.email",
          value: '"new@example.com"',
          where: "id = 1",
        },
        mockContext,
      )) as { rowsAffected: number };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_REPLACE");
      expect(result.rowsAffected).toBe(1);
    });
  });

  describe("mysql_json_remove", () => {
    it("should remove JSON values at specified paths", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_remove")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "profile",
          paths: ["$.temp", "$.legacy"],
          where: "id = 1",
        },
        mockContext,
      )) as { rowsAffected: number };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_REMOVE");
      expect(call).toContain("?, ?");
      expect(result.rowsAffected).toBe(1);
    });
  });

  describe("mysql_json_array_append", () => {
    it("should append value to JSON array", async () => {
      mockAdapter.executeWriteQuery.mockResolvedValue({
        rows: [],
        rowsAffected: 1,
        executionTimeMs: 5,
      });

      const tool = tools.find((t) => t.name === "mysql_json_array_append")!;
      const result = (await tool.handler(
        {
          table: "users",
          column: "tags",
          path: "$.interests",
          value: '"coding"',
          where: "id = 1",
        },
        mockContext,
      )) as { rowsAffected: number };

      expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
      const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_ARRAY_APPEND");
      expect(result.rowsAffected).toBe(1);
    });
  });
});

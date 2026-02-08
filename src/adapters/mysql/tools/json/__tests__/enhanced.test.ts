/**
 * mysql-mcp - JSON Enhanced Tools Unit Tests
 *
 * Comprehensive tests for enhanced.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createJsonMergeTool,
  createJsonDiffTool,
  createJsonNormalizeTool,
  createJsonStatsTool,
  createJsonIndexSuggestTool,
} from "../enhanced.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("JSON Enhanced Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createJsonMergeTool", () => {
    it("should merge JSON using patch mode", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ merged: '{"a":1}' }]),
      );

      const tool = createJsonMergeTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          json1: "{}",
          json2: '{"a":1}',
          mode: "patch",
        },
        mockContext,
      )) as { merged: any };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_MERGE_PATCH");
      expect(result.merged).toEqual({ a: 1 });
    });

    it("should merge JSON using preserve mode", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ merged: "[1, 2]" }]),
      );

      const tool = createJsonMergeTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          json1: "[1]",
          json2: "[2]",
          mode: "preserve",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("JSON_MERGE_PRESERVE");
    });

    it("should return object result directly if not string", async () => {
      // When MySQL returns an object instead of JSON string (some drivers)
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ merged: { direct: "object" } }]),
      );

      const tool = createJsonMergeTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          json1: "{}",
          json2: '{"direct": "object"}',
          mode: "patch",
        },
        mockContext,
      )) as { merged: any };

      expect(result.merged).toEqual({ direct: "object" });
    });
  });

  describe("createJsonDiffTool", () => {
    it("should compare JSON documents", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            identical: 1,
            json1_contains_json2: 1,
            json2_contains_json1: 1,
            json1_keys: "[]",
            json2_keys: "[]",
          },
        ]),
      );

      const tool = createJsonDiffTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          json1: "{}",
          json2: "{}",
        },
        mockContext,
      )) as {
        identical: boolean;
        addedKeys: string[];
        removedKeys: string[];
        differences: unknown[];
      };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      expect(result.identical).toBe(true);
      expect(result.addedKeys).toEqual([]);
      expect(result.removedKeys).toEqual([]);
      expect(result.differences).toEqual([]);
    });

    it("should parse string keys into array", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            identical: 0,
            json1_contains_json2: 0,
            json2_contains_json1: 0,
            json1_length: 2,
            json2_length: 1,
            json1_keys: '["a", "b"]',
            json2_keys: '["c"]',
          },
        ]),
      );

      const tool = createJsonDiffTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          json1: '{"a":1,"b":2}',
          json2: '{"c":3}',
        },
        mockContext,
      )) as {
        json1Keys: string[];
        json2Keys: string[];
        addedKeys: string[];
        removedKeys: string[];
      };

      expect(result.json1Keys).toEqual(["a", "b"]);
      expect(result.json2Keys).toEqual(["c"]);
      expect(result.addedKeys).toEqual(["c"]);
      expect(result.removedKeys).toEqual(["a", "b"]);
    });

    it("should handle non-string keys (already parsed by driver)", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          {
            identical: 0,
            json1_keys: ["x", "y"],
            json2_keys: ["z"],
          },
        ]),
      );

      const tool = createJsonDiffTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          json1: '{"x":1,"y":2}',
          json2: '{"z":3}',
        },
        mockContext,
      )) as { json1Keys: string[]; json2Keys: string[] };

      expect(result.json1Keys).toEqual(["x", "y"]);
      expect(result.json2Keys).toEqual(["z"]);
    });

    it("should return value-level differences for shared keys", async () => {
      // First call: the main comparison query
      mockAdapter.executeReadQuery
        .mockResolvedValueOnce(
          createMockQueryResult([
            {
              identical: 0,
              json1_contains_json2: 0,
              json2_contains_json1: 0,
              json1_length: 2,
              json2_length: 2,
              json1_keys: '["name", "age"]',
              json2_keys: '["name", "age"]',
            },
          ]),
        )
        // name: same value
        .mockResolvedValueOnce(
          createMockQueryResult([{ v1: '"Alice"', v2: '"Alice"' }]),
        )
        // age: different values
        .mockResolvedValueOnce(createMockQueryResult([{ v1: "30", v2: "31" }]));

      const tool = createJsonDiffTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          json1: '{"name":"Alice","age":30}',
          json2: '{"name":"Alice","age":31}',
        },
        mockContext,
      )) as {
        differences: { path: string; value1: unknown; value2: unknown }[];
        addedKeys: string[];
        removedKeys: string[];
      };

      expect(result.addedKeys).toEqual([]);
      expect(result.removedKeys).toEqual([]);
      expect(result.differences).toHaveLength(1);
      expect(result.differences[0].path).toBe("$.age");
      expect(result.differences[0].value1).toBe(30);
      expect(result.differences[0].value2).toBe(31);
    });
  });

  describe("createJsonNormalizeTool", () => {
    it("should normalize JSON keys", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ key_name: "k1" }, { key_name: "k2" }]),
        ) // Keys
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "INTEGER", count: 10 }]),
        ) // k1 types
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "STRING", count: 5 }]),
        ); // k2 types

      const tool = createJsonNormalizeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          limit: 10,
        },
        mockContext,
      )) as { uniqueKeys: string[] };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(result.uniqueKeys).toEqual(["k1", "k2"]);
    });

    it("should include where clause in queries", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ key_name: "k1" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "STRING", count: 1 }]),
        );

      const tool = createJsonNormalizeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "data",
          column: "json_col",
          where: "active = 1",
          limit: 10,
        },
        mockContext,
      );

      const keysQuery = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(keysQuery).toContain("WHERE active = 1");
    });

    it("should set truncated flag when more than 20 keys", async () => {
      const manyKeys = Array.from({ length: 25 }, (_, i) => ({
        key_name: `key${i}`,
      }));
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult(manyKeys),
      );
      // Mock type queries for first 20 keys
      for (let i = 0; i < 20; i++) {
        mockAdapter.executeQuery.mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "STRING", count: 1 }]),
        );
      }

      const tool = createJsonNormalizeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
          limit: 100,
        },
        mockContext,
      )) as { truncated: boolean; keyCount: number };

      expect(result.truncated).toBe(true);
      expect(result.keyCount).toBe(25);
    });
  });

  describe("createJsonStatsTool", () => {
    it("should calculate JSON stats", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            total_rows: 100,
            null_count: 5,
            avg_length: 10,
          },
        ]),
      );

      const tool = createJsonStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
        },
        mockContext,
      )) as { totalSampled: number };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result.totalSampled).toBe(100);
    });

    it("should include where clause in stats query", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            total_rows: 50,
            null_count: 2,
          },
        ]),
      );

      const tool = createJsonStatsTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "data",
          column: "json_col",
          where: 'status = "active"',
        },
        mockContext,
      );

      const query = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(query).toContain('WHERE status = "active"');
    });
  });

  describe("createJsonIndexSuggestTool", () => {
    it("should suggest indexes for high cardinality keys", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ key_name: "id" }, { key_name: "type" }]),
        ) // Keys
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "INTEGER", cardinality: 50 }]),
        ) // id card
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "STRING", cardinality: 5 }]),
        ); // type card

      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
        },
        mockContext,
      )) as { suggestions: any[] };

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].path).toBe("$.id"); // higher cardinality first
      expect(result.suggestions[0].indexDdl).toContain("BIGINT");
    });

    it("should use DOUBLE for double value types", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ key_name: "price" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "DOUBLE", cardinality: 100 }]),
        );

      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "products",
          column: "data",
        },
        mockContext,
      )) as { suggestions: any[] };

      expect(result.suggestions[0].indexDdl).toContain("DOUBLE");
    });

    it("should use TINYINT(1) for boolean value types", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ key_name: "active" }]))
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "BOOLEAN", cardinality: 2 }]),
        );

      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "users",
          column: "settings",
        },
        mockContext,
      )) as { suggestions: any[] };

      expect(result.suggestions[0].indexDdl).toContain("TINYINT(1)");
    });

    it("should skip keys with cardinality <= 1", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(
          createMockQueryResult([{ key_name: "constant" }]),
        )
        .mockResolvedValueOnce(
          createMockQueryResult([{ value_type: "STRING", cardinality: 1 }]),
        );

      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
        },
        mockContext,
      )) as { suggestions: any[] };

      expect(result.suggestions).toHaveLength(0);
    });

    it("should handle UNKNOWN type for undefined valueType", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce(createMockQueryResult([{ key_name: "mystery" }]))
        .mockResolvedValueOnce(createMockQueryResult([{ cardinality: 10 }])); // No value_type

      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
        },
        mockContext,
      )) as { suggestions: any[] };

      expect(result.suggestions[0].type).toBe("UNKNOWN");
      expect(result.suggestions[0].indexDdl).toContain("VARCHAR(255)");
    });

    it("should limit suggestions to top 5", async () => {
      const keys = Array.from({ length: 10 }, (_, i) => ({
        key_name: `key${i}`,
      }));
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult(keys),
      );
      for (let i = 0; i < 10; i++) {
        mockAdapter.executeQuery.mockResolvedValueOnce(
          createMockQueryResult([
            { value_type: "STRING", cardinality: 100 - i * 10 },
          ]),
        );
      }

      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "data",
          column: "json_col",
        },
        mockContext,
      )) as { suggestions: any[] };

      expect(result.suggestions).toHaveLength(5);
    });
  });

  describe("P154 Graceful Error Handling", () => {
    const tableError = new Error("Table 'testdb.nonexistent' doesn't exist");

    it("json_normalize should return exists: false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(tableError);
      const tool = createJsonNormalizeTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { table: "nonexistent", column: "doc" },
        mockContext,
      );
      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("json_stats should return exists: false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(tableError);
      const tool = createJsonStatsTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { table: "nonexistent", column: "doc" },
        mockContext,
      );
      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("json_index_suggest should return exists: false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(tableError);
      const tool = createJsonIndexSuggestTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { table: "nonexistent", column: "doc" },
        mockContext,
      );
      expect(result).toEqual({ exists: false, table: "nonexistent" });
    });

    it("json_merge should return success: false for invalid input", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Invalid JSON text"),
      );
      const tool = createJsonMergeTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { json1: "not-json", json2: "{}" },
        mockContext,
      );
      expect(result).toEqual({ success: false, error: "Invalid JSON text" });
    });

    it("json_diff should return success: false for invalid input", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Invalid JSON text"),
      );
      const tool = createJsonDiffTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler(
        { json1: "not-json", json2: "{}" },
        mockContext,
      );
      expect(result).toEqual({ success: false, error: "Invalid JSON text" });
    });
  });
});

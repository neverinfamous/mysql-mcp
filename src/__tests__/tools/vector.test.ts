import { describe, it, expect, beforeEach, vi } from "vitest";
import { getVectorTools } from "../../adapters/mysql/tools/vector/index.js";
import { MySQLAdapter } from "../../adapters/mysql/mysql-adapter/index.js";
import type { ToolDefinition } from "../../types/index.js";

// Mock the MySQLAdapter
const mockExecuteQuery = vi.fn().mockImplementation(async (sql) => {
  if (sql === "SELECT VERSION() as version") {
    return { rows: [{ version: "9.0.0" }] };
  }
  return { rows: [], affectedRows: 0 };
});

const mockAdapter = {
  executeQuery: mockExecuteQuery,
} as unknown as MySQLAdapter;

describe("Vector Tools", () => {
  let tools: Map<string, ToolDefinition>;

  beforeEach(() => {
    const toolsArray = getVectorTools(mockAdapter);
    tools = new Map(toolsArray.map((t) => [t.name, t]));
    
    // Reset mocks
    mockExecuteQuery.mockClear?.();
  });

  describe("Version Gating", () => {
    it("should return an error for MySQL versions < 9.0 on vector tools", async () => {
      // Mock version 8.0.35
      const oldExecuteQuery = vi.fn().mockImplementation(async (sql) => {
        if (sql === "SELECT VERSION() as version") {
          return { rows: [{ version: "8.0.35" }] };
        }
        return { rows: [], affectedRows: 0 };
      });
      const oldAdapter = {
        executeQuery: oldExecuteQuery,
      } as unknown as MySQLAdapter;
      
      const oldToolsArray = getVectorTools(oldAdapter);
      const oldTools = new Map(oldToolsArray.map((t) => [t.name, t]));
      
      const storeTool = oldTools.get("mysql_vector_store")!;
      
      const result = await storeTool.handler(
        { table: "t1", column: "v1", id: 1, vector: [1, 2, 3] },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("EXTENSION_MISSING");
      expect(result.error).toContain("MySQL 9.0+ is required");
    });

    it("should return an error for MySQL versions < 9.1 on create_index", async () => {
      const indexTool = tools.get("mysql_vector_create_index")!;
      
      const result = await indexTool.handler(
        { table: "t1", column: "v1" },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("EXTENSION_MISSING");
      expect(result.error).toContain("MySQL 9.1+ is required");
    });
  });

  describe("mysql_vector_store", () => {
    it("should fail validation with empty vector", async () => {
      const tool = tools.get("mysql_vector_store")!;
      const result = await tool.handler(
        { table: "t1", column: "v1", id: 1, vector: [] },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
    });
  });

  describe("mysql_vector_batch_store", () => {
    it("should fail validation with empty items array", async () => {
      const tool = tools.get("mysql_vector_batch_store")!;
      const result = await tool.handler(
        { table: "t1", column: "v1", items: [] },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
    });
  });

  describe("mysql_vector_search", () => {
    it("should fail validation with invalid metric", async () => {
      const tool = tools.get("mysql_vector_search")!;
      const result = await tool.handler(
        { table: "t1", column: "v1", queryVector: [1,2,3], metric: "INVALID" },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
    });
    
    it("should return success when queryVector is valid", async () => {

      
      const mockResult = Object.assign(
        function (query: string) {
          if (typeof query === "string") {
            if (query.includes("VERSION()")) {
              return Promise.resolve({ rows: [{ version: "9.0.0" }] });
            }
            if (query.includes("INFORMATION_SCHEMA")) {
              return Promise.resolve({ rows: [{ COLUMN_NAME: "id" }] });
            }
          }
          return Promise.resolve({ rows: [{ id: 1, distance: 0.1 }], affectedRows: 0 });
        },
        { _isMockFunction: true }
      );
      const successAdapter = {
        executeQuery: mockResult,
      } as unknown as MySQLAdapter;
      
      const successTool = getVectorTools(successAdapter).find(t => t.name === "mysql_vector_search")!;
      
      const result = await successTool.handler(
        { table: "t1", column: "v1", queryVector: [1, 2, 3] },
        {} as any
      ) as any;
      
      console.log(result);
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
    });
  });

  describe("mysql_vector_hybrid_search", () => {
    it("should fail validation if neither queryVector nor queryText is provided", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1" },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
      expect(result.error).toContain("At least one of queryVector or queryText must be provided");
    });

    it("should handle missing FULLTEXT index gracefully", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      mockAdapter.executeQuery.mockImplementation(async (sql) => {
        if (sql === "SELECT VERSION() as version") return { rows: [{ version: "9.0.0" }] };
        throw new Error("Can't find FULLTEXT index");
      });
      
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1", queryText: "test" },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("FULLTEXT_INDEX_MISSING");
      expect(result.suggestion).toContain("Create a FULLTEXT index");
    });

    it("should handle missing table gracefully", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      mockAdapter.executeQuery.mockImplementation(async (sql) => {
        if (sql === "SELECT VERSION() as version") return { rows: [{ version: "9.0.0" }] };
        throw new Error("Table 't1' doesn't exist");
      });
      
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1", queryVector: [1,2,3] },
        {} as any
      ) as any;
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });

    it("should strip vectorColumn from default select output", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      mockAdapter.executeQuery.mockImplementation(async (sql) => {
        if (sql === "SELECT VERSION() as version") return { rows: [{ version: "9.0.0" }] };
        if (sql.includes("INFORMATION_SCHEMA.COLUMNS")) return { rows: [{ COLUMN_NAME: 'id' }] };
        return { rows: [{ id: 1, v1: '[0.1, 0.2]', text: 'hello', combined_score: 1.0 }] };
      });
      
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1", queryVector: [1,2,3], queryText: "hello" },
        {} as any
      ) as any;
      
      console.log("TEST RESULT:", result);
      expect(result.success).toBe(true);
      expect(result.data.results[0]).not.toHaveProperty('v1');
      expect(result.data.results[0]).toHaveProperty('id');
      expect(result.data.results[0]).toHaveProperty('text');
    });
  });
});

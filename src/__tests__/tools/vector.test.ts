import { describe, it, expect, beforeEach, vi } from "vitest";
import { getVectorTools } from "../../adapters/mysql/tools/vector/index.js";
import { type MySQLAdapter } from "../../adapters/mysql/mysql-adapter/index.js";
import type { ToolDefinition, RequestContext } from "../../types/index.js";

const mockExecuteQuery = vi.fn().mockResolvedValue({ rows: [], affectedRows: 0 });
const mockRawQuery = vi.fn().mockImplementation(async (sql) => {
  if (sql === "SELECT @@version as Value") {
    return { rows: [{ Value: "9.0.0" }] };
  }
  if (sql.includes("SHOW COLUMNS")) {
    return { rows: [{ Field: "v1", Type: "vector(3)", Null: "YES", Default: null, Extra: "" }, { Field: "id", Type: "int" }] };
  }
  return { rows: [], affectedRows: 0 };
});

const mockAdapter = {
  executeQuery: mockExecuteQuery,
  rawQuery: mockRawQuery,
  getHealth: vi.fn().mockResolvedValue({ version: "9.1.0" }),
  describeTable: vi.fn().mockResolvedValue({ columns: [{ name: "v1", type: "vector(3)" }, { name: "id", type: "int" }] }),
} as unknown as MySQLAdapter;

const mockContext: RequestContext = { timestamp: new Date(), requestId: "test" };

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
      const oldRawQuery = vi.fn().mockImplementation(async (sql) => {
        if (sql === "SELECT @@version as Value") {
          return { rows: [{ Value: "8.0.35" }] };
        }
        if (sql.includes("SHOW COLUMNS")) {
          return { rows: [{ Field: "v1", Type: "vector(3)", Null: "YES", Default: null, Extra: "" }] };
        }
        return { rows: [], affectedRows: 0 };
      });
      const oldAdapter = {
        executeQuery: vi.fn().mockResolvedValue({ rows: [], affectedRows: 0 }),
        rawQuery: oldRawQuery,
        getHealth: vi.fn().mockResolvedValue({ version: "8.0.35" }),
        describeTable: vi.fn().mockResolvedValue({ columns: [{ name: "v1", type: "vector(3)" }] }),
      } as unknown as MySQLAdapter;
      
      const oldToolsArray = getVectorTools(oldAdapter);
      const oldTools = new Map(oldToolsArray.map((t) => [t.name, t]));
      
      const storeTool = oldTools.get("mysql_vector_store")!;
      
      const result = await storeTool.handler(
        { table: "t1", column: "v1", id: 1, vector: [1, 2, 3] },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("EXTENSION_MISSING");
      expect(result.error).toContain("MySQL 9.0+ is required");
    });

    it("should return an error for MySQL versions < 9.1 on create_index", async () => {
      mockAdapter.getHealth = vi.fn().mockResolvedValue({ version: "9.0.0" });
      const oldToolsArray = getVectorTools(mockAdapter);
      const oldTools = new Map(oldToolsArray.map((t) => [t.name, t]));
      const indexTool = oldTools.get("mysql_vector_create_index")!;
      
      const result = await indexTool.handler(
        { table: "t1", column: "v1" },
        mockContext
      );
      
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
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
    });
  });

  describe("mysql_vector_batch_store", () => {
    it("should fail validation with empty items array", async () => {
      const tool = tools.get("mysql_vector_batch_store")!;
      const result = await tool.handler(
        { table: "t1", column: "v1", items: [] },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
    });
  });

  describe("mysql_vector_search", () => {
    it("should fail validation with invalid metric", async () => {
      const tool = tools.get("mysql_vector_search")!;
      const result = await tool.handler(
        { table: "t1", column: "v1", queryVector: [1,2,3], metric: "INVALID" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
    });
    
    it("should return success when queryVector is valid", async () => {

      
      const mockRawQuery = Object.assign(
        function (query: string) {
          if (typeof query === "string") {
            if (query.includes("SELECT @@version as Value")) {
              return Promise.resolve({ rows: [{ Value: "9.0.0" }] });
            }
            if (query.includes("SHOW COLUMNS")) {
              return Promise.resolve({ rows: [{ Field: "v1", Type: "vector(3)" }] });
            }
          }
          return Promise.resolve({ rows: [], affectedRows: 0 });
        },
        { _isMockFunction: true }
      );
      const mockExecuteQuery = Object.assign(
        function (_query: string) {
          return Promise.resolve({ rows: [{ id: 1, distance: 0.1 }], affectedRows: 0 });
        },
        { _isMockFunction: true }
      );
      const successAdapter = {
        executeQuery: mockExecuteQuery,
        rawQuery: mockRawQuery,
        getHealth: vi.fn().mockResolvedValue({ version: "9.1.0" }),
        describeTable: vi.fn().mockResolvedValue({ columns: [{ name: "v1", type: "vector(3)" }] }),
      } as unknown as MySQLAdapter;
      
      const successTool = getVectorTools(successAdapter).find(t => t.name === "mysql_vector_search")!;
      
      const result = await successTool.handler(
        { table: "t1", column: "v1", queryVector: [1, 2, 3] },
        mockContext
      );
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(1);
    });
  });

  describe("mysql_vector_hybrid_search", () => {
    it("should fail validation if neither queryVector nor queryText is provided", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.category).toBe("validation");
      expect(result.error).toContain("At least one of queryVector or queryText must be provided");
    });

    it("should handle missing FULLTEXT index gracefully", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      mockAdapter.rawQuery = vi.fn().mockImplementation(async (sql) => {
        if (sql === "SELECT @@version as Value") return { rows: [{ Value: "9.0.0" }] };
        if (sql.includes("SHOW COLUMNS")) return { rows: [{ Field: 'id' }, { Field: 'v1', Type: 'vector(3)' }] };
        return { rows: [] };
      });
      mockAdapter.executeQuery = vi.fn().mockImplementation(async (_sql) => {
        throw new Error("Can't find FULLTEXT index");
      });
      
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1", queryText: "test" },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("FULLTEXT_INDEX_MISSING");
      expect(result.suggestion).toContain("Create a FULLTEXT index");
    });

    it("should handle missing table gracefully", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      mockAdapter.rawQuery = vi.fn().mockImplementation(async (sql) => {
        if (sql === "SELECT @@version as Value") return { rows: [{ Value: "9.0.0" }] };
        if (sql.includes("SHOW COLUMNS")) return { rows: [{ Field: 'id' }, { Field: 'v1', Type: 'vector(3)' }] };
        return { rows: [] };
      });
      mockAdapter.executeQuery = vi.fn().mockImplementation(async (_sql) => {
        throw new Error("Table 't1' does not exist");
      });
      
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1", queryVector: [1,2,3] },
        mockContext
      );
      
      expect(result.success).toBe(false);
      expect(result.code).toBe("TABLE_NOT_FOUND");
    });

    it("should strip vectorColumn from default select output", async () => {
      const tool = tools.get("mysql_vector_hybrid_search")!;
      mockAdapter.rawQuery = vi.fn().mockImplementation(async (sql) => {
        if (sql === "SELECT @@version as Value") return { rows: [{ Value: "9.0.0" }] };
        if (sql.includes("SHOW COLUMNS")) return { rows: [{ Field: 'id' }, { Field: 'v1', Type: 'vector(3)' }] };
        return { rows: [] };
      });
      mockAdapter.executeQuery = vi.fn().mockImplementation(async (_sql) => {
        return { rows: [{ id: 1, v1: '[0.1, 0.2]', text: 'hello', combined_score: 1.0 }] };
      });
      
      const result = await tool.handler(
        { table: "t1", vectorColumn: "v1", textColumn: "t1", queryVector: [1,2,3], queryText: "hello" },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.data.results[0]).not.toHaveProperty('v1');
      expect(result.data.results[0]).toHaveProperty('id');
      expect(result.data.results[0]).toHaveProperty('text');
    });
  });
});

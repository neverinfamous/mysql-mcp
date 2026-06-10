import { describe, it, expect, beforeEach } from "vitest";
import { getVectorTools } from "../../adapters/mysql/tools/vector/index.js";
import { MySQLAdapter } from "../../adapters/mysql/mysql-adapter.js";
import type { ToolDefinition } from "../../types/index.js";

// Mock the MySQLAdapter
const mockExecuteQuery = Object.assign(
  function () {
    return Promise.resolve({ rows: [], affectedRows: 0 });
  },
  { _isMockFunction: true }
);

const mockGetServerVersion = Object.assign(
  function () {
    return Promise.resolve({ major: 9, minor: 0, patch: 0, raw: "9.0.0" });
  },
  { _isMockFunction: true }
);

const mockAdapter = {
  executeQuery: mockExecuteQuery,
  getServerVersion: mockGetServerVersion,
} as unknown as MySQLAdapter;

describe("Vector Tools", () => {
  let tools: Map<string, ToolDefinition>;

  beforeEach(() => {
    const toolsArray = getVectorTools(mockAdapter);
    tools = new Map(toolsArray.map((t) => [t.name, t]));
    
    // Reset mocks
    mockExecuteQuery.mockClear?.();
    mockGetServerVersion.mockClear?.();
  });

  describe("Version Gating", () => {
    it("should return an error for MySQL versions < 9.0 on vector tools", async () => {
      // Mock version 8.0.35
      const oldVersionMock = Object.assign(
        function () {
          return Promise.resolve({ major: 8, minor: 0, patch: 35, raw: "8.0.35" });
        },
        { _isMockFunction: true }
      );
      const oldAdapter = {
        executeQuery: mockExecuteQuery,
        getServerVersion: oldVersionMock,
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
        getServerVersion: mockGetServerVersion,
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
  });
});

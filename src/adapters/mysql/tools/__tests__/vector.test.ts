import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVectorTools } from "../vector/index.js";
import {
  createVectorInfoTool,
  createVectorCreateIndexTool,
  createVectorOptimizeTool,
  createVectorStatsTool,
} from "../vector/management.js";
import {
  createVectorStoreTool,
  createVectorBatchStoreTool,
  createVectorDeleteTool,
  createVectorGetTool,
} from "../vector/storage.js";
import {
  createVectorSearchTool,
  createVectorRangeSearchTool,
  createVectorHybridSearchTool,
} from "../vector/search.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../__tests__/mocks/index.js";
import type { MySQLAdapter } from "../../mysql-adapter/index.js";

describe("Vector Tools", () => {
  let adapter: any;
  const context = createMockRequestContext();

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockMySQLAdapter();
    
    adapter.executeQuery.mockImplementation(async (query: string) => {
      if (query.includes("VERSION()")) {
        return { rows: [{ version: "9.1.0" }] };
      }
      if (query.includes("INFORMATION_SCHEMA.COLUMNS")) {
        return { rows: [
          { COLUMN_NAME: "vec", COLUMN_TYPE: "vector(1536)", IS_NULLABLE: "YES", COLUMN_DEFAULT: null, EXTRA: "", DATA_TYPE: "vector" }
        ] };
      }
      if (query.includes("count(*)") || query.includes("COUNT(*)")) {
        return { rows: [{ total_rows: 10, non_null_count: 8, null_count: 2, min_dimensions: 1536, max_dimensions: 1536 }] };
      }
      if (query.includes("INSERT") || query.includes("UPDATE") || query.includes("DELETE")) {
        return { rowsAffected: 1 };
      }
      if (query.includes("VECTOR_TO_STRING")) {
        return { rows: [{ vector_str: "[0.1, 0.2]", id: 1 }] };
      }
      if (query.includes("distance") || query.includes("DISTANCE") || query.includes("VECTOR_DISTANCE")) {
        return { rows: [{ id: 1, distance: 0.1 }] };
      }
      if ((query.includes("SELECT") && query.includes("FROM `my_table`") && query.includes("WHERE `id` = ?"))) {
        return { rows: [{ vector_str: "[0.1, 0.2]", id: 1 }] };
      }
      // For hybrid search and base cases
      if (query.includes("SELECT") && query.includes("FROM")) {
        return { rows: [{ id: 1, distance: 0.1 }] };
      }
      return { rows: [] };
    });

    adapter.executeReadQuery.mockImplementation(async (query: string) => {
      return { rows: [] };
    });

    adapter.rawQuery.mockImplementation(async (query: string) => {
      if (query.includes("ANALYZE TABLE")) {
        return { rows: [{ Msg_type: "status", Msg_text: "OK" }] };
      }
      return { rows: [] };
    });

    adapter.transaction = vi.fn().mockImplementation(async (cb: any) => {
      return cb(adapter);
    });
  });

  describe("getVectorTools", () => {
    it("should return all vector tools", () => {
      const tools = getVectorTools(adapter);
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.map(t => t.name)).toContain("mysql_vector_info");
    });
  });

  describe("mysql_vector_info", () => {
    it("should return vector column info", async () => {
      const tool = createVectorInfoTool(adapter);
      const result = await tool.handler({ table: "my_table" }, context) as any;
      if (!result.success) console.error("info error:", result.error);
      expect(result.success).toBe(true);
      expect(result.data.columns[0].dimensions).toBe(1536);
    });

    it("should handle error", async () => {
      const tool = createVectorInfoTool(adapter);
      adapter.executeQuery.mockRejectedValueOnce(new Error("DB Error"));
      const result = await tool.handler({ table: "my_table" }, context) as any;
      expect(result.success).toBe(false);
    });
  });

  describe("mysql_vector_create_index", () => {
    it("should create index", async () => {
      const tool = createVectorCreateIndexTool(adapter);
      const result = await tool.handler({ table: "my_table", column: "vec", indexName: "idx_vec" }, context) as any;
      if (!result.success) console.error("create index error:", result.error);
      expect(result.success).toBe(true);
    });
  });

  describe("mysql_vector_optimize", () => {
    it("should optimize table", async () => {
      const tool = createVectorOptimizeTool(adapter);
      const result = await tool.handler({ table: "my_table" }, context) as any;
      if (!result.success) console.error("optimize error:", result.error);
      expect(result.success).toBe(true);
    });
  });

  describe("mysql_vector_stats", () => {
    it("should retrieve stats", async () => {
      const tool = createVectorStatsTool(adapter);
      const result = await tool.handler({ table: "my_table", column: "vec" }, context) as any;
      if (!result.success) console.error("stats error:", result.error);
      expect(result.success).toBe(true);
      expect(result.data.totalRows).toBe(10);
      expect(result.data.stats.nullCount).toBe(2);
    });
  });

  describe("mysql_vector_store", () => {
    it("should store a vector", async () => {
      const tool = createVectorStoreTool(adapter);
      const result = await tool.handler({ table: "my_table", column: "vec", idColumn: "id", id: 1, vector: [0.1, 0.2] }, context) as any;
      if (!result.success) console.error("store error:", result.error);
      expect(result.success).toBe(true);
    });
  });

  describe("mysql_vector_batch_store", () => {
    it("should batch store vectors", async () => {
      const tool = createVectorBatchStoreTool(adapter);
      const result = await tool.handler({
        table: "my_table",
        column: "vec",
        idColumn: "id",
        items: [{ id: 1, vector: [0.1, 0.2] }]
      }, context) as any;
      if (!result.success) console.error("batch store error:", result.error);
      expect(result.success).toBe(true);
    });
  });

  describe("mysql_vector_delete", () => {
    it("should delete vector", async () => {
      const tool = createVectorDeleteTool(adapter);
      const result = await tool.handler({ table: "my_table", column: "vec", idColumn: "id", id: 1 }, context) as any;
      if (!result.success) console.error("delete error:", result.error);
      expect(result.success).toBe(true);
    });
  });

  describe("mysql_vector_get", () => {
    it("should get vector", async () => {
      const tool = createVectorGetTool(adapter);
      const result = await tool.handler({ table: "my_table", column: "vec", idColumn: "id", id: 1 }, context) as any;
      if (!result.success) console.error("get error:", result.error);
      expect(result.success).toBe(true);
      expect(result.data.vector).toEqual([0.1, 0.2]);
    });
  });

  describe("mysql_vector_search", () => {
    it("should perform nearest neighbor search", async () => {
      const tool = createVectorSearchTool(adapter);
      const result = await tool.handler({
        table: "my_table",
        column: "vec",
        queryVector: [0.1, 0.2],
        limit: 10
      }, context) as any;
      if (!result.success) console.error("search error:", result.error);
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
    });
  });

  describe("mysql_vector_range_search", () => {
    it("should perform range search", async () => {
      const tool = createVectorRangeSearchTool(adapter);
      const result = await tool.handler({
        table: "my_table",
        column: "vec",
        queryVector: [0.1, 0.2],
        maxDistance: 0.5
      }, context) as any;
      if (!result.success) console.error("range search error:", result.error);
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
    });
  });

  describe("mysql_vector_hybrid_search", () => {
    it("should perform hybrid search", async () => {
      const tool = createVectorHybridSearchTool(adapter);
      const result = await tool.handler({
        table: "my_table",
        vectorColumn: "vec",
        textColumn: "text",
        queryVector: [0.1, 0.2],
        queryText: "hello",
        filter: "status = 'active'"
      }, context) as any;
      if (!result.success) console.error("hybrid search error:", result.error);
      expect(result.success).toBe(true);
      expect(result.data.results).toHaveLength(1);
    });
  });
});

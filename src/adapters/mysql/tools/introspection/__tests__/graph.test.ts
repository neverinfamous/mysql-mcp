import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createDependencyGraphTool,
  createTopologicalSortTool,
  createCascadeSimulatorTool,
} from "../graph/index.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Graph Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();

    // Mock for schema/table existence
    mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

    // Mock table info
    mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
      if (query.includes("information_schema.SCHEMATA")) {
        return createMockQueryResult([{ SCHEMA_NAME: "testdb" }]);
      }
      if (query.includes("information_schema.TABLES")) {
        return createMockQueryResult([
          {
            schema_name: "testdb",
            table_name: "A",
            row_count: 100,
            size_bytes: 1024,
          },
          {
            schema_name: "testdb",
            table_name: "B",
            row_count: 200,
            size_bytes: 2048,
          },
        ]);
      }
      if (query.includes("KEY_COLUMN_USAGE")) {
        return createMockQueryResult([
          {
            constraint_name: "fk_a_b",
            from_schema: "testdb",
            from_table: "A",
            from_column: "b_id",
            to_schema: "testdb",
            to_table: "B",
            to_column: "id",
            on_delete: "CASCADE",
            on_update: "CASCADE",
          },
        ]);
      }
      if (query.includes("SELECT DATABASE()")) {
        return createMockQueryResult([{ db: "testdb" }]);
      }
      return createMockQueryResult([]);
    });
  });

  describe("Dependency Graph Tool", () => {
    let tool: ReturnType<typeof createDependencyGraphTool>;

    beforeEach(() => {
      tool = createDependencyGraphTool(mockAdapter);
    });

    it("should generate a dependency graph", async () => {
      const result = await tool.handler({ schema: "testdb" }, mockContext);
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.nodes).toBeDefined();
      expect(data.edges).toBeDefined();
      expect(data.stats).toBeDefined();
      expect(data.nodes.length).toBeGreaterThan(0);
      expect(data.edges.length).toBeGreaterThan(0);
    });

    it("should handle compact mode", async () => {
      const result = await tool.handler(
        { schema: "testdb", compact: true },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.nodes[0].rowCount).toBeUndefined(); // Compact mode should not have rowCount
      expect(data.edges[0].constraint).toBeUndefined(); // Compact mode should not have constraint details
    });

    it("should truncate nodes if maxDepth is provided", async () => {
      const result = await tool.handler(
        { schema: "testdb", maxDepth: 0 },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.nodes).toBeDefined();
    });

    it("should truncate nodes if limit is reached", async () => {
      const result = await tool.handler(
        { schema: "testdb", limit: 1 },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.nodes.length).toBe(1);
      expect(data.hint).toContain("Result truncated");
    });
  });

  describe("Topological Sort Tool", () => {
    let tool: ReturnType<typeof createTopologicalSortTool>;

    beforeEach(() => {
      tool = createTopologicalSortTool(mockAdapter);
    });

    it("should return tables in dependency order", async () => {
      const result = await tool.handler(
        { schema: "testdb", direction: "create" },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");
      expect(data.order).toBeDefined();
      expect(data.direction).toBe("create");

      // B has no dependencies, A depends on B.
      // So B should be before A in "create" direction
      const bIndex = data.order.findIndex((o: any) => o.table === "B");
      const aIndex = data.order.findIndex((o: any) => o.table === "A");
      expect(bIndex).toBeLessThan(aIndex);
    });

    it("should return tables in reverse order for drop", async () => {
      const result = await tool.handler(
        { schema: "testdb", direction: "drop" },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");

      // B has no dependencies, A depends on B.
      // So A should be before B in "drop" direction
      const aIndex = data.order.findIndex((o: any) => o.table === "A");
      const bIndex = data.order.findIndex((o: any) => o.table === "B");
      expect(aIndex).toBeLessThan(bIndex);
    });

    it("should fail on circular dependencies", async () => {
      mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
        if (query.includes("information_schema.SCHEMATA")) {
          return createMockQueryResult([{ SCHEMA_NAME: "testdb" }]);
        }
        if (query.includes("KEY_COLUMN_USAGE")) {
          return createMockQueryResult([
            {
              constraint_name: "fk_a_b",
              from_schema: "testdb",
              from_table: "A",
              from_column: "b_id",
              to_schema: "testdb",
              to_table: "B",
              to_column: "id",
              on_delete: "CASCADE",
              on_update: "CASCADE",
            },
            {
              constraint_name: "fk_b_a",
              from_schema: "testdb",
              from_table: "B",
              from_column: "a_id",
              to_schema: "testdb",
              to_table: "A",
              to_column: "id",
              on_delete: "CASCADE",
              on_update: "CASCADE",
            },
          ]);
        }
        return createMockQueryResult([]);
      });

      const result = await tool.handler({ schema: "testdb" }, mockContext);
      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("Circular dependency");
    });
  });

  describe("Cascade Simulator Tool", () => {
    let tool: ReturnType<typeof createCascadeSimulatorTool>;

    beforeEach(() => {
      tool = createCascadeSimulatorTool(mockAdapter);
    });

    it("should simulate delete cascades", async () => {
      const result = await tool.handler(
        { schema: "testdb", table: "B", operation: "DELETE" },
        mockContext,
      );
      if (!Reflect.get(result || {}, "success"))
        console.log("CASCADE ERROR:", Reflect.get(result || {}, "error"));
      expect(Reflect.get(result || {}, "success")).toBe(true);
      const data = Reflect.get(result || {}, "data");

      console.log("CASCADE DATA:", JSON.stringify(data, null, 2));

      expect(data.sourceTable).toBe("testdb.B");
      expect(data.affectedTables).toBeDefined();
      expect(data.affectedTables[0].table).toBe("A");
      expect(data.affectedTables[0].action).toBe("CASCADE");
    });

    it("should fail gracefully if table does not exist", async () => {
      const result = await tool.handler(
        { schema: "testdb", table: "nonexistent", operation: "DELETE" },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(false);
      expect(Reflect.get(result || {}, "error")).toContain("does not exist");
    });

    it("should fallback to database schema if no schema provided", async () => {
      const result = await tool.handler(
        { table: "B", operation: "DELETE" },
        mockContext,
      );
      expect(Reflect.get(result || {}, "success")).toBe(true);
      expect(Reflect.get(result || {}, "data").sourceTable).toBe("testdb.B");
    });
  });
});

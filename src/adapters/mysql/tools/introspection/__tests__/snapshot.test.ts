import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSchemaSnapshotTool } from "../snapshot.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema Snapshot Tool", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tool: ReturnType<typeof createSchemaSnapshotTool>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tool = createSchemaSnapshotTool(mockAdapter);
    mockContext = createMockRequestContext();

    // Mock for schema/table existence
    mockAdapter.executeReadQuery.mockImplementation(async (query: string) => {
      if (query.includes("information_schema.SCHEMATA")) {
        return createMockQueryResult([{ SCHEMA_NAME: "testdb" }]);
      }
      if (query.includes("FROM information_schema.TABLES")) {
        return createMockQueryResult([
          {
            schema_name: "testdb",
            name: "users",
            type: "BASE TABLE",
            row_count: 100,
            size_bytes: 1024,
          },
        ]);
      }
      if (query.includes("FROM information_schema.VIEWS")) {
        const isCompact = query.includes("NULL AS definition");
        return createMockQueryResult([
          {
            schema_name: "testdb",
            name: "active_users",
            type: "view",
            definition: isCompact ? null : "SELECT * FROM users",
          },
        ]);
      }
      if (query.includes("FROM information_schema.STATISTICS")) {
        return createMockQueryResult([
          {
            name: "PRIMARY",
            table_name: "users",
            schema_name: "testdb",
            type: "BTREE",
            is_unique: 1,
          },
        ]);
      }
      if (query.includes("FROM information_schema.TABLE_CONSTRAINTS")) {
        return createMockQueryResult([
          {
            name: "PRIMARY",
            table_name: "users",
            schema_name: "testdb",
            type: "PRIMARY KEY",
          },
        ]);
      }
      if (query.includes("FROM information_schema.ROUTINES")) {
        return createMockQueryResult([
          {
            schema_name: "testdb",
            name: "get_user",
            type: "PROCEDURE",
            return_type: "int",
            volatility: "CONTAINS SQL",
            definition: "BEGIN END",
          },
        ]);
      }
      if (query.includes("FROM information_schema.TRIGGERS")) {
        return createMockQueryResult([
          {
            name: "before_insert",
            table_name: "users",
            schema_name: "testdb",
            timing: "BEFORE",
            events: "INSERT",
            definition: "SET NEW.id = 1",
          },
        ]);
      }
      if (query.includes("FROM information_schema.COLUMNS")) {
        return createMockQueryResult([
          {
            TABLE_SCHEMA: "testdb",
            TABLE_NAME: "users",
            COLUMN_NAME: "id",
            COLUMN_TYPE: "int",
            IS_NULLABLE: "NO",
            COLUMN_KEY: "PRI",
          },
          {
            TABLE_SCHEMA: "testdb",
            TABLE_NAME: "users",
            COLUMN_NAME: "email",
            COLUMN_TYPE: "varchar",
            IS_NULLABLE: "YES",
          },
        ]);
      }
      return createMockQueryResult([]);
    });
  });

  it("should return a complete snapshot when no sections are specified", async () => {
    const result = await tool.handler(
      { schema: "testdb", compact: false },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.tables).toBeDefined();
    expect(data.views).toBeDefined();
    expect(data.indexes).toBeDefined();
    expect(data.constraints).toBeDefined();
    expect(data.functions).toBeDefined();
    expect(data.triggers).toBeDefined();

    // Check that columns were attached to tables
    expect(data.tables[0].columns).toBeDefined();
    expect(data.tables[0].columns.length).toBe(2);
  });

  it("should only return specified sections", async () => {
    const result = await tool.handler(
      { schema: "testdb", sections: ["tables"] },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.tables).toBeDefined();
    expect(data.views).toBeUndefined();
    expect(data.indexes).toBeUndefined();
  });

  it("should handle compact mode without returning definitions and columns", async () => {
    const result = await tool.handler(
      { schema: "testdb", sections: ["views"], compact: true },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.views).toBeDefined();
    expect(data.views[0].definition).toBeUndefined(); // Compact mode sets definition to NULL which gets stripped
  });
});

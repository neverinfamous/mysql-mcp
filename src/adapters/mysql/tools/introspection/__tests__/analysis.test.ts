import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createConstraintAnalysisTool,
  createMigrationRisksTool,
} from "../analysis.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockQueryResult,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("Constraint Analysis Tool", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tool: ReturnType<typeof createConstraintAnalysisTool>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tool = createConstraintAnalysisTool(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();

    // Mock for schema/table existence
    mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));
  });

  it("should have correct tool metadata", () => {
    expect(tool.name).toBe("mysql_constraint_analysis");
    expect(tool.group).toBe("introspection");
  });

  it("should detect missing primary keys", async () => {
    // Schema check
    mockAdapter.executeReadQuery.mockResolvedValueOnce(
      createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
    );
    // Return tables without PKs
    mockAdapter.executeReadQuery.mockResolvedValueOnce(
      createMockQueryResult([
        { schema_name: "testdb", table_name: "no_pk_table" },
      ]),
    );
    // Missing NOT NULL query
    mockAdapter.executeReadQuery.mockResolvedValueOnce(
      createMockQueryResult([]),
    );

    const result = await tool.handler(
      { schema: "testdb", checks: ["missing_pk"] },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.findings).toBeDefined();
    expect(data.findings[0].type).toBe("missing_pk");
    expect(data.findings[0].table).toBe("testdb.no_pk_table");
  });

  it("should detect circular dependencies", async () => {
    // Schema check
    mockAdapter.executeReadQuery.mockResolvedValueOnce(
      createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
    );

    // Mock foreign keys query for circular dependency
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

    const result = await tool.handler(
      { schema: "testdb", checks: ["circular_dependency"] },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.findings).toBeDefined();
    expect(data.findings.length).toBeGreaterThan(0);
    expect(data.findings[0].type).toBe("circular_dependency");
  });

  it("should detect missing NOT NULL columns", async () => {
    // Schema check
    mockAdapter.executeReadQuery.mockResolvedValueOnce(
      createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
    );
    // Missing NOT NULL query
    mockAdapter.executeReadQuery.mockResolvedValueOnce(
      createMockQueryResult([
        {
          schema_name: "testdb",
          table_name: "users",
          column_name: "email",
          type: "varchar(255)",
        },
      ]),
    );

    const result = await tool.handler(
      { schema: "testdb", checks: ["missing_not_null"] },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.findings).toBeDefined();
    expect(data.findings[0].type).toBe("missing_not_null");
    expect(data.findings[0].table).toBe("testdb.users");
  });
});

describe("Migration Risks Tool", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let tool: ReturnType<typeof createMigrationRisksTool>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    tool = createMigrationRisksTool(mockAdapter as unknown as MySQLAdapter);
    mockContext = createMockRequestContext();
  });

  it("should have correct tool metadata", () => {
    expect(tool.name).toBe("mysql_migration_risks");
    expect(tool.group).toBe("introspection");
  });

  it("should detect critical risk like DROP TABLE", async () => {
    const result = await tool.handler(
      { statements: ["DROP TABLE users;"] },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.risks).toBeDefined();
    expect(data.risks[0].severity).toBe("critical");
    expect(data.summary.highestSeverity).toBe("critical");
  });

  it("should detect high risk like MODIFY COLUMN", async () => {
    const result = await tool.handler(
      {
        statements: [
          "ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NOT NULL;",
        ],
      },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.risks).toBeDefined();
    // MODIFY COLUMN is high, NOT NULL is high
    expect(data.summary.highestSeverity).toBe("high");
  });

  it("should detect medium risk like adding foreign key", async () => {
    const result = await tool.handler(
      {
        statements: [
          "ALTER TABLE users ADD CONSTRAINT fk_user FOREIGN KEY (id) REFERENCES other(id);",
        ],
      },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.risks).toBeDefined();
    expect(data.summary.highestSeverity).toBe("medium");
  });

  it("should detect low risk like CREATE TABLE without IF NOT EXISTS", async () => {
    const result = await tool.handler(
      { statements: ["CREATE TABLE users (id INT);"] },
      mockContext,
    );

    expect(Reflect.get(result || {}, "success")).toBe(true);
    const data = Reflect.get(result || {}, "data");
    expect(data.risks).toBeDefined();
    expect(data.summary.highestSeverity).toBe("low");
  });
});

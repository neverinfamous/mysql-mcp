import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListConstraintsTool } from "../constraints.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema Constraint Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("mysql_list_constraints", () => {
    it("should query INFORMATION_SCHEMA for constraints", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { name: "PRIMARY", type: "PRIMARY KEY", tableName: "users" },
        ]),
      );

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("information_schema");
      expect(result).toBeDefined();
    });

    it("should filter by table when provided", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain("users");
    });

    it("should filter by type when provided", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users", type: "PRIMARY KEY" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CONSTRAINT_TYPE = ?");
      const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain("PRIMARY KEY");
    });

    it("should parse schema.table format and pass schema as first param", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "myschema.users" }, mockContext);

      const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe("myschema"); // schemaName
      expect(params[1]).toBe("users"); // tableName
    });

    it("should pass null schema for unqualified table names", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users" }, mockContext);

      const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBeNull(); // schemaName should be null
      expect(params[1]).toBe("users");
    });

    it("should handle special characters in schema-qualified names", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          {
            name: "fk_orders",
            type: "FOREIGN KEY",
            referencedTable: "customers",
          },
        ]),
      );

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler(
        { table: "test_db.order_items" },
        mockContext,
      );

      const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(params[0]).toBe("test_db");
      expect(params[1]).toBe("order_items");
      expect(result).toHaveProperty("constraints");
    });
  });
});

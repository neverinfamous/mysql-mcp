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
      // Existence check returns table found
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Main query returns constraints
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([
          { name: "PRIMARY", type: "PRIMARY KEY", tableName: "users" },
        ]),
      );

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(call).toContain("information_schema");
      expect(result).toBeDefined();
    });

    it("should filter by table when provided", async () => {
      // Existence check returns table found
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Main query returns empty constraints
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const params = mockAdapter.executeQuery.mock.calls[1][1] as unknown[];
      expect(params).toContain("users");
    });

    it("should filter by type when provided", async () => {
      // Existence check returns table found
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Main query returns empty constraints
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users", type: "PRIMARY KEY" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      const call = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(call).toContain("CONSTRAINT_TYPE = ?");
      const params = mockAdapter.executeQuery.mock.calls[1][1] as unknown[];
      expect(params).toContain("PRIMARY KEY");
    });

    it("should parse schema.table format and pass schema as first param", async () => {
      // Existence check returns table found
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Main query returns empty constraints
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "myschema.users" }, mockContext);

      const params = mockAdapter.executeQuery.mock.calls[1][1] as unknown[];
      expect(params[0]).toBe("myschema"); // schemaName
      expect(params[1]).toBe("users"); // tableName
    });

    it("should pass null schema for unqualified table names", async () => {
      // Existence check returns table found
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Main query returns empty constraints
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler({ table: "users" }, mockContext);

      const params = mockAdapter.executeQuery.mock.calls[1][1] as unknown[];
      expect(params[0]).toBeNull(); // schemaName should be null
      expect(params[1]).toBe("users");
    });

    it("should handle special characters in schema-qualified names", async () => {
      // Existence check returns table found
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "order_items" }]),
      );
      // Main query returns constraints
      mockAdapter.executeQuery.mockResolvedValueOnce(
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

      const params = mockAdapter.executeQuery.mock.calls[1][1] as unknown[];
      expect(params[0]).toBe("test_db");
      expect(params[1]).toBe("order_items");
      expect(result).toHaveProperty("constraints");
    });

    it("should return exists false for nonexistent table (P154)", async () => {
      // First call (existence check) returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent_table" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent_table");
      // Should only call once (existence check), not the main query
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
    });
    it("should return structured error for invalid constraint type", async () => {
      const tool = createListConstraintsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "users", type: "INVALID_TYPE" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });
  });
});

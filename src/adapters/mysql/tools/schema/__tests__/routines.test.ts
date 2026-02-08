import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createListStoredProceduresTool,
  createListFunctionsTool,
} from "../routines.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema Routine Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("mysql_list_stored_procedures", () => {
    it("should query INFORMATION_SCHEMA for routines", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { ROUTINE_NAME: "get_users", ROUTINE_TYPE: "PROCEDURE" },
        ]),
      );

      const tool = createListStoredProceduresTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("information_schema.ROUTINES");
      expect(result).toBeDefined();
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListStoredProceduresTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { exists: boolean; schema: string };

      expect(result.exists).toBe(false);
      expect(result.schema).toBe("nonexistent_db");
    });
  });

  describe("mysql_list_functions", () => {
    it("should query INFORMATION_SCHEMA for functions", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { ROUTINE_NAME: "calc_total", ROUTINE_TYPE: "FUNCTION" },
        ]),
      );

      const tool = createListFunctionsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListFunctionsTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { exists: boolean; schema: string };

      expect(result.exists).toBe(false);
      expect(result.schema).toBe("nonexistent_db");
    });
  });
});

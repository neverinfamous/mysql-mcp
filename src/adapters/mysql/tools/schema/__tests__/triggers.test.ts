import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListTriggersTool } from "../triggers.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema Trigger Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("mysql_list_triggers", () => {
    it("should query INFORMATION_SCHEMA for triggers", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { TRIGGER_NAME: "before_insert", EVENT_MANIPULATION: "INSERT" },
        ]),
      );

      const tool = createListTriggersTool(
        mockAdapter,
      );
      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[1][0];
      expect(call).toContain("information_schema.TRIGGERS");
      expect(result).toBeDefined();
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListTriggersTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return exists false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
      );
      // Table existence check returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListTriggersTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { schema: "testdb", table: "nonexistent_table" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should filter by table when provided", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
      );
      // Table existence check returns a row
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ TABLE_NAME: "users" }]),
      );
      // Triggers query returns empty
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListTriggersTool(
        mockAdapter,
      );
      await tool.handler({ schema: "testdb", table: "users" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
      const call = mockAdapter.executeQuery.mock.calls[2][0];
      expect(call).toContain("EVENT_OBJECT_TABLE = ?");
      const params = mockAdapter.executeQuery.mock.calls[2][1];
      expect(params).toContain("users");
    });
  });
});

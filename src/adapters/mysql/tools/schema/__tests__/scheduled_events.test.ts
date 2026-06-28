import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListEventsTool } from "../scheduled_events.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema Event Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("mysql_list_events", () => {
    it("should query INFORMATION_SCHEMA for events", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { EVENT_NAME: "daily_cleanup", STATUS: "ENABLED" },
        ]),
      );

      const tool = createListEventsTool(mockAdapter);
      const result = await tool.handler({ schema: "testdb" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[1][0];
      expect(call).toContain("information_schema.EVENTS");
      expect(result).toBeDefined();
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListEventsTool(mockAdapter);
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should filter by status when provided", async () => {
      mockAdapter.executeQuery.mockResolvedValueOnce(
        createMockQueryResult([{ SCHEMA_NAME: "testdb" }]),
      );
      mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

      const tool = createListEventsTool(mockAdapter);
      await tool.handler({ schema: "testdb", status: "ENABLED" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[1][0];
      expect(call).toContain("STATUS = ?");
      const params = mockAdapter.executeQuery.mock.calls[1][1];
      expect(params).toContain("ENABLED");
    });
    it("should return structured error for invalid status", async () => {
      const tool = createListEventsTool(mockAdapter);
      const result = (await tool.handler(
        { status: "INVALID_STATUS" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockAdapter.executeQuery).not.toHaveBeenCalled();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListEventsTool } from "../scheduled_events.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
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

      const tool = createListEventsTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("information_schema.EVENTS");
      expect(result).toBeDefined();
    });

    it("should return exists false for nonexistent schema", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListEventsTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        { schema: "nonexistent_db" },
        mockContext,
      )) as { exists: boolean; schema: string };

      expect(result.exists).toBe(false);
      expect(result.schema).toBe("nonexistent_db");
    });

    it("should filter by status when provided", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createListEventsTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler({ status: "ENABLED" }, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("STATUS = ?");
      const params = mockAdapter.executeQuery.mock.calls[0][1] as unknown[];
      expect(params).toContain("ENABLED");
    });
    it("should return structured error for invalid status", async () => {
      const tool = createListEventsTool(mockAdapter as unknown as MySQLAdapter);
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

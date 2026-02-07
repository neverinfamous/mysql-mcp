import { describe, it, expect, vi, beforeEach } from "vitest";
import { createListViewsTool, createCreateViewTool } from "../views.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Schema View Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("mysql_list_views", () => {
    it("should query INFORMATION_SCHEMA for views", async () => {
      mockAdapter.executeQuery.mockResolvedValue(
        createMockQueryResult([
          { TABLE_NAME: "user_view", VIEW_DEFINITION: "SELECT * FROM users" },
        ]),
      );

      const tool = createListViewsTool(mockAdapter as unknown as MySQLAdapter);
      const result = await tool.handler({}, mockContext);

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("information_schema.VIEWS");
      expect(result).toBeDefined();
    });
  });

  describe("mysql_create_view", () => {
    it("should execute CREATE VIEW query", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCreateViewTool(mockAdapter as unknown as MySQLAdapter);
      const result = (await tool.handler(
        {
          name: "active_users",
          definition: "SELECT * FROM users WHERE active = 1",
        },
        mockContext,
      )) as { success: boolean };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("CREATE");
      expect(call).toContain("VIEW");
      expect(result.success).toBe(true);
    });

    it("should use CREATE OR REPLACE when orReplace is true", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCreateViewTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          name: "active_users",
          definition: "SELECT * FROM users WHERE active = 1",
          orReplace: true,
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("OR REPLACE");
    });

    it("should validate view name", async () => {
      const tool = createCreateViewTool(mockAdapter as unknown as MySQLAdapter);
      await expect(
        tool.handler(
          {
            name: "invalid-name",
            definition: "SELECT 1",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid view name");
    });

    it("should include WITH CHECK OPTION when specified", async () => {
      mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));
      const tool = createCreateViewTool(mockAdapter as unknown as MySQLAdapter);

      await tool.handler(
        {
          name: "valid_view",
          definition: "SELECT * FROM t1",
          checkOption: "CASCADED",
        },
        mockContext,
      );

      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("WITH CASCADED CHECK OPTION");
    });

    it("should return success false when view already exists", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'my_view' already exists"),
      );
      const tool = createCreateViewTool(mockAdapter as unknown as MySQLAdapter);

      const result = (await tool.handler(
        {
          name: "my_view",
          definition: "SELECT 1",
        },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("already exists");
    });

    it("should return success false for invalid SQL definition", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent_table' doesn't exist"),
      );
      const tool = createCreateViewTool(mockAdapter as unknown as MySQLAdapter);

      const result = (await tool.handler(
        {
          name: "bad_view",
          definition: "SELECT * FROM nonexistent_table",
        },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("doesn't exist");
    });
  });
});

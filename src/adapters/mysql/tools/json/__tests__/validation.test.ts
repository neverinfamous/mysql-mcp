import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createJsonSetTool,
  createJsonInsertTool,
  createJsonReplaceTool,
  createJsonArrayAppendTool,
} from "../core.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("JSON Tool Validation", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
    // Mock success for valid queries
    mockAdapter.executeWriteQuery.mockResolvedValue({
      rowsAffected: 1,
      insertId: 0,
    });
  });

  describe("Validation Logic", () => {
    it('should throw error for unquoted string "green"', async () => {
      const tool = createJsonSetTool(mockAdapter as unknown as MySQLAdapter);
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$.color",
            value: "green",
            where: "id = 1",
          },
          mockContext,
        ),
      ).rejects.toThrow(/Invalid JSON value/);
    });

    it('should accept quoted string "\\"green\\""', async () => {
      const tool = createJsonSetTool(mockAdapter as unknown as MySQLAdapter);
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$.color",
            value: '"green"',
            where: "id = 1",
          },
          mockContext,
        ),
      ).resolves.not.toThrow();
    });

    it("should accept numbers", async () => {
      const tool = createJsonInsertTool(mockAdapter as unknown as MySQLAdapter);
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$.count",
            value: 42,
            where: "id = 1",
          },
          mockContext,
        ),
      ).resolves.not.toThrow();
    });

    it("should throw for invalid JSON object string", async () => {
      const tool = createJsonReplaceTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$.obj",
            value: '{key: "invalid"}', // Missing quotes on key
            where: "id = 1",
          },
          mockContext,
        ),
      ).rejects.toThrow(/Invalid JSON value/);
    });

    it("should validate array append values", async () => {
      const tool = createJsonArrayAppendTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$",
            value: "invalid_string",
            where: "id = 1",
          },
          mockContext,
        ),
      ).rejects.toThrow(/Invalid JSON value/);
    });
  });
});

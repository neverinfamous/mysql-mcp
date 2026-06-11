import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createJsonSetTool,
  createJsonInsertTool,
  createJsonReplaceTool,
  createJsonArrayAppendTool,
} from "../core.js";
import type {} from "../../../mysql-adapter/index.js";
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
    it('should accept bare string "green" (auto-wrapped)', async () => {
      const tool = createJsonSetTool(mockAdapter);
      // Bare strings are now auto-wrapped to valid JSON strings
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
      ).resolves.not.toThrow();
    });

    it('should accept quoted string "\\"green\\""', async () => {
      const tool = createJsonSetTool(mockAdapter);
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
      const tool = createJsonInsertTool(mockAdapter);
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

    it("should accept invalid JSON object string (auto-wrapped)", async () => {
      const tool = createJsonReplaceTool(
        mockAdapter,
      );
      // Invalid JSON is now wrapped as a plain string, not rejected
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$.obj",
            value: '{key: "invalid"}', // Treated as a string value
            where: "id = 1",
          },
          mockContext,
        ),
      ).resolves.not.toThrow();
    });

    it("should accept array append with bare string (auto-wrapped)", async () => {
      const tool = createJsonArrayAppendTool(
        mockAdapter,
      );
      // Bare strings are now auto-wrapped
      await expect(
        tool.handler(
          {
            table: "data",
            column: "json_col",
            path: "$",
            value: "auto_wrapped_string",
            where: "id = 1",
          },
          mockContext,
        ),
      ).resolves.not.toThrow();
    });
  });
});

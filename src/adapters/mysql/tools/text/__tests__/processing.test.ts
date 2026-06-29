/**
 * mysql-mcp - Text Processing Tools Unit Tests
 *
 * Comprehensive tests for processing.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createRegexpMatchTool,
  createLikeSearchTool,
  createSoundexTool,
  createSubstringTool,
  createConcatTool,
  createCollationConvertTool,
} from "../processing.js";
import type {} from "../../../mysql-adapter/index.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Text Processing Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createRegexpMatchTool", () => {
    it("should perform regex match query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1 }]),
      );

      const tool = createRegexpMatchTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        {
          table: "users",
          column: "email",
          pattern: "^admin",
        },
        mockContext,
      )) as { data: { rows: unknown[] } };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("REGEXP ?");
      expect(result.data.rows).toHaveLength(1);
    });
  });

  describe("createLikeSearchTool", () => {
    it("should perform like search query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createLikeSearchTool(mockAdapter);
      await tool.handler(
        {
          table: "users",
          column: "name",
          pattern: "John%",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("LIKE ?");
    });
  });

  describe("createSoundexTool", () => {
    it("should perform soundex query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSoundexTool(mockAdapter);
      await tool.handler(
        {
          table: "users",
          column: "name",
          value: "Jon",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("SOUNDEX(`name`) = SOUNDEX(?)");
    });
  });

  describe("createSubstringTool", () => {
    it("should extract substring with length", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ substring_value: "abc" }]),
      );

      const tool = createSubstringTool(mockAdapter);
      await tool.handler(
        {
          table: "logs",
          column: "message",
          start: 1,
          length: 3,
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("SUBSTRING(`message`, ?, ?)");
    });

    it("should extract substring without length", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSubstringTool(mockAdapter);
      await tool.handler(
        {
          table: "logs",
          column: "message",
          start: 5,
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("SUBSTRING(`message`, ?)");
    });
    it("should extract substring with where clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSubstringTool(mockAdapter);
      await tool.handler(
        {
          table: "logs",
          column: "message",
          start: 1,
          where: "id > 100",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("WHERE id > 100");
    });
  });

  describe("createConcatTool", () => {
    it("should concatenate columns", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ full_name: "John Doe" }]),
      );

      const tool = createConcatTool(mockAdapter);
      await tool.handler(
        {
          table: "users",
          columns: ["first_name", "last_name"],
          separator: " ",
          alias: "full_name",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain(
        "CONCAT_WS(?, `first_name`, `last_name`) as `full_name`",
      );
    });

    it("should concatenate with where clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createConcatTool(mockAdapter);
      await tool.handler(
        {
          table: "users",
          columns: ["first_name", "last_name"],
          where: "active = 1",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("WHERE active = 1");
    });
  });

  describe("createCollationConvertTool", () => {
    it("should convert charset", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCollationConvertTool(
        mockAdapter,
      );
      await tool.handler(
        {
          table: "legacy",
          column: "text_col",
          charset: "utf8mb4",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("CONVERT(`text_col` USING utf8mb4)");
      expect(call).not.toContain("COLLATE");
    });

    it("should convert charset and collation", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCollationConvertTool(
        mockAdapter,
      );
      await tool.handler(
        {
          table: "legacy",
          column: "text_col",
          charset: "utf8mb4",
          collation: "utf8mb4_bin",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain(
        "CONVERT(`text_col` USING utf8mb4) COLLATE utf8mb4_bin",
      );
    });

    it("should convert with where clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCollationConvertTool(
        mockAdapter,
      );
      await tool.handler(
        {
          table: "legacy",
          column: "text_col",
          charset: "utf8mb4",
          where: "id < 1000",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0];
      expect(call).toContain("WHERE id < 1000");
    });
  });

  // =========================================================================
  // P154 Error Handling Tests
  // =========================================================================

  describe("P154: createRegexpMatchTool error handling", () => {
    it("should return success: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' does not exist"),
      );

      const tool = createRegexpMatchTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", column: "email", pattern: "^a" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return success: false for other query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown column 'bad_col' in 'field list'"),
      );

      const tool = createRegexpMatchTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", column: "bad_col", pattern: "^a" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("P154: createLikeSearchTool error handling", () => {
    it("should return success: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' does not exist"),
      );

      const tool = createLikeSearchTool(mockAdapter);
      const result = (await tool.handler(
        { table: "nonexistent", column: "name", pattern: "%test%" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return success: false for other query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown column 'bad_col' in 'field list'"),
      );

      const tool = createLikeSearchTool(mockAdapter);
      const result = (await tool.handler(
        { table: "users", column: "bad_col", pattern: "%test%" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("P154: createSoundexTool error handling", () => {
    it("should return success: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' does not exist"),
      );

      const tool = createSoundexTool(mockAdapter);
      const result = (await tool.handler(
        { table: "nonexistent", column: "name", value: "Jon" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return success: false for other query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown column 'bad_col' in 'field list'"),
      );

      const tool = createSoundexTool(mockAdapter);
      const result = (await tool.handler(
        { table: "users", column: "bad_col", value: "Jon" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("P154: createSubstringTool error handling", () => {
    it("should return success: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' does not exist"),
      );

      const tool = createSubstringTool(mockAdapter);
      const result = (await tool.handler(
        { table: "nonexistent", column: "name", start: 1 },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return success: false for other query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown column 'bad_col' in 'field list'"),
      );

      const tool = createSubstringTool(mockAdapter);
      const result = (await tool.handler(
        { table: "users", column: "bad_col", start: 1 },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("P154: createConcatTool error handling", () => {
    it("should return success: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' does not exist"),
      );

      const tool = createConcatTool(mockAdapter);
      const result = (await tool.handler(
        { table: "nonexistent", columns: ["a", "b"] },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return success: false for other query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown column 'bad_col' in 'field list'"),
      );

      const tool = createConcatTool(mockAdapter);
      const result = (await tool.handler(
        { table: "users", columns: ["bad_col", "other"] },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("P154: createCollationConvertTool error handling", () => {
    it("should return success: false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' does not exist"),
      );

      const tool = createCollationConvertTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", column: "name", charset: "utf8mb4" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not exist");
    });

    it("should return success: false for other query errors", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Unknown character set: 'invalid_charset'"),
      );

      const tool = createCollationConvertTool(
        mockAdapter,
      );
      const result = (await tool.handler(
        { table: "users", column: "name", charset: "invalid_charset" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unknown character set");
    });
  });
});

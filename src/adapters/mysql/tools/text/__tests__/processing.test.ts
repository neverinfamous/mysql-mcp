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
import type { MySQLAdapter } from "../../MySQLAdapter.js";
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
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "users",
          column: "email",
          pattern: "^admin",
        },
        mockContext,
      )) as { rows: unknown[] };

      expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("REGEXP ?");
      expect(result.rows).toHaveLength(1);
    });
  });

  describe("createLikeSearchTool", () => {
    it("should perform like search query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createLikeSearchTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "users",
          column: "name",
          pattern: "John%",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("LIKE ?");
    });
  });

  describe("createSoundexTool", () => {
    it("should perform soundex query", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSoundexTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "users",
          column: "name",
          value: "Jon",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("SOUNDEX(`name`) = SOUNDEX(?)");
    });
  });

  describe("createSubstringTool", () => {
    it("should extract substring with length", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ substring_value: "abc" }]),
      );

      const tool = createSubstringTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "logs",
          column: "message",
          start: 1,
          length: 3,
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("SUBSTRING(`message`, ?, ?)");
    });

    it("should extract substring without length", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSubstringTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "logs",
          column: "message",
          start: 5,
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("SUBSTRING(`message`, ?)");
    });
    it("should extract substring with where clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createSubstringTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "logs",
          column: "message",
          start: 1,
          where: "id > 100",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("WHERE id > 100");
    });
  });

  describe("createConcatTool", () => {
    it("should concatenate columns", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ full_name: "John Doe" }]),
      );

      const tool = createConcatTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "users",
          columns: ["first_name", "last_name"],
          separator: " ",
          alias: "full_name",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "CONCAT_WS(?, `first_name`, `last_name`) as `full_name`",
      );
    });

    it("should concatenate with where clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createConcatTool(mockAdapter as unknown as MySQLAdapter);
      await tool.handler(
        {
          table: "users",
          columns: ["first_name", "last_name"],
          where: "active = 1",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("WHERE active = 1");
    });
  });

  describe("createCollationConvertTool", () => {
    it("should convert charset", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCollationConvertTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "legacy",
          column: "text_col",
          charset: "utf8mb4",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("CONVERT(`text_col` USING utf8mb4)");
      expect(call).not.toContain("COLLATE");
    });

    it("should convert charset and collation", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCollationConvertTool(
        mockAdapter as unknown as MySQLAdapter,
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

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "CONVERT(`text_col` USING utf8mb4) COLLATE utf8mb4_bin",
      );
    });

    it("should convert with where clause", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createCollationConvertTool(
        mockAdapter as unknown as MySQLAdapter,
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

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("WHERE id < 1000");
    });
  });
});

/**
 * mysql-mcp - Text Fulltext Tools Unit Tests
 *
 * Comprehensive tests for fulltext.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createFulltextCreateTool,
  createFulltextSearchTool,
  createFulltextBooleanTool,
  createFulltextExpandTool,
} from "../fulltext.js";
import type { MySQLAdapter } from "../../MySQLAdapter.js";
import {
  createMockMySQLAdapter,
  createMockRequestContext,
  createMockQueryResult,
} from "../../../../../__tests__/mocks/index.js";

describe("Text Fulltext Tools", () => {
  let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockMySQLAdapter();
    mockContext = createMockRequestContext();
  });

  describe("createFulltextCreateTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createFulltextCreateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_fulltext_create");
    });

    it("should create fulltext index", async () => {
      const tool = createFulltextCreateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["title", "content"],
          indexName: "ft_idx",
        },
        mockContext,
      )) as { indexName: string };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "CREATE FULLTEXT INDEX `ft_idx` ON `articles` (`title`, `content`)",
      );
      expect(result.indexName).toBe("ft_idx");
    });

    it("should generate index name if not provided", async () => {
      const tool = createFulltextCreateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["title", "content"],
        },
        mockContext,
      )) as { indexName: string };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "CREATE FULLTEXT INDEX `ft_articles_title_content`",
      );
      expect(result.indexName).toBe("ft_articles_title_content");
    });
  });

  describe("createFulltextSearchTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_fulltext_search");
    });

    it("should search in natural language mode by default", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1 }]),
      );

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "articles",
          columns: ["title", "content"],
          query: "database",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain(
        "MATCH(`title`, `content`) AGAINST(? IN NATURAL LANGUAGE MODE)",
      );
    });

    it("should search in boolean mode", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "articles",
          columns: ["title"],
          query: "+mysql -oracle",
          mode: "BOOLEAN",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("MATCH(`title`) AGAINST(? IN BOOLEAN MODE)");
    });

    it("should search with query expansion", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "articles",
          columns: ["title"],
          query: "database",
          mode: "EXPANSION",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("MATCH(`title`) AGAINST(? WITH QUERY EXPANSION)");
    });
  });

  describe("createFulltextBooleanTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createFulltextBooleanTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_fulltext_boolean");
    });

    it("should search in boolean mode", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFulltextBooleanTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "articles",
          columns: ["title"],
          query: "+mysql",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("MATCH(`title`) AGAINST(? IN BOOLEAN MODE)");
    });
  });

  describe("createFulltextExpandTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createFulltextExpandTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_fulltext_expand");
    });

    it("should search with query expansion", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

      const tool = createFulltextExpandTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await tool.handler(
        {
          table: "articles",
          columns: ["title"],
          query: "database",
        },
        mockContext,
      );

      const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
      expect(call).toContain("MATCH(`title`) AGAINST(? WITH QUERY EXPANSION)");
    });
  });
});

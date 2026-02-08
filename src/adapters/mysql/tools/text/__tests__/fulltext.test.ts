/**
 * mysql-mcp - Text Fulltext Tools Unit Tests
 *
 * Comprehensive tests for fulltext.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createFulltextCreateTool,
  createFulltextDropTool,
  createFulltextSearchTool,
  createFulltextBooleanTool,
  createFulltextExpandTool,
} from "../fulltext.js";
import type { MySQLAdapter } from "../../../MySQLAdapter.js";
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

    it("should return graceful response for duplicate index", async () => {
      const dupError = new Error("Duplicate key name 'ft_idx'");
      (dupError as Error & { errno?: number }).errno = 1061;
      mockAdapter.executeQuery.mockRejectedValue(dupError);

      const tool = createFulltextCreateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["title"],
          indexName: "ft_idx",
        },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("already exists");
      expect(result.reason).toContain("ft_idx");
    });

    it("should rethrow non-duplicate errors", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Connection refused"),
      );

      const tool = createFulltextCreateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await expect(
        tool.handler(
          { table: "articles", columns: ["title"], indexName: "ft_idx" },
          mockContext,
        ),
      ).rejects.toThrow("Connection refused");
    });

    it("should return exists:false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createFulltextCreateTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", columns: ["title"], indexName: "ft_idx" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });
  });

  describe("createFulltextDropTool", () => {
    it("should create tool with correct definition", () => {
      const tool = createFulltextDropTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      expect(tool.name).toBe("mysql_fulltext_drop");
    });

    it("should drop fulltext index", async () => {
      const tool = createFulltextDropTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "articles", indexName: "ft_idx" },
        mockContext,
      )) as { success: boolean; indexName: string };

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(call).toContain("DROP INDEX `ft_idx` ON `articles`");
      expect(result.success).toBe(true);
    });

    it("should return graceful response for non-existent index", async () => {
      const dropError = new Error(
        "Can't DROP 'ft_nonexistent'; check that column/key exists",
      );
      (dropError as Error & { errno?: number }).errno = 1091;
      mockAdapter.executeQuery.mockRejectedValue(dropError);

      const tool = createFulltextDropTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "articles", indexName: "ft_nonexistent" },
        mockContext,
      )) as { success: boolean; reason: string };

      expect(result.success).toBe(false);
      expect(result.reason).toContain("does not exist");
      expect(result.reason).toContain("ft_nonexistent");
    });

    it("should rethrow non-drop errors", async () => {
      mockAdapter.executeQuery.mockRejectedValue(new Error("Access denied"));

      const tool = createFulltextDropTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      await expect(
        tool.handler({ table: "articles", indexName: "ft_idx" }, mockContext),
      ).rejects.toThrow("Access denied");
    });

    it("should return exists:false for nonexistent table", async () => {
      mockAdapter.executeQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createFulltextDropTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", indexName: "ft_idx" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
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

    it("should truncate text columns when maxLength is specified", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, body: "A".repeat(300), relevance: 1.5 },
          { id: 2, body: "Short text", relevance: 0.5 },
        ]),
      );

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["body"],
          query: "test",
          maxLength: 50,
        },
        mockContext,
      )) as { rows: Record<string, unknown>[]; count: number };

      expect(result.count).toBe(2);
      expect((result.rows[0].body as string).length).toBe(53); // 50 + "..."
      expect((result.rows[0].body as string).endsWith("...")).toBe(true);
      expect(result.rows[1].body).toBe("Short text"); // Not truncated
    });

    it("should not truncate when maxLength is not specified", async () => {
      const longText = "A".repeat(500);
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([{ id: 1, body: longText, relevance: 1.0 }]),
      );

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["body"],
          query: "test",
        },
        mockContext,
      )) as { rows: Record<string, unknown>[] };

      expect(result.rows[0].body).toBe(longText);
    });

    it("should return exists:false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", columns: ["title"], query: "test" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });

    it("should return success:false for generic query error", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Can't find FULLTEXT index matching the column list"),
      );

      const tool = createFulltextSearchTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "articles", columns: ["title"], query: "test" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("FULLTEXT index");
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

    it("should truncate text columns when maxLength is specified", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, content: "B".repeat(200), relevance: 1.0 },
        ]),
      );

      const tool = createFulltextBooleanTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["content"],
          query: "+test",
          maxLength: 100,
        },
        mockContext,
      )) as { rows: Record<string, unknown>[] };

      expect((result.rows[0].content as string).length).toBe(103); // 100 + "..."
      expect((result.rows[0].content as string).endsWith("...")).toBe(true);
    });

    it("should return exists:false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createFulltextBooleanTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", columns: ["title"], query: "+test" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });

    it("should return success:false for generic query error", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Can't find FULLTEXT index matching the column list"),
      );

      const tool = createFulltextBooleanTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "articles", columns: ["title"], query: "+test" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("FULLTEXT index");
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

    it("should truncate text columns when maxLength is specified", async () => {
      mockAdapter.executeReadQuery.mockResolvedValue(
        createMockQueryResult([
          { id: 1, body: "C".repeat(150), relevance: 2.0 },
        ]),
      );

      const tool = createFulltextExpandTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        {
          table: "articles",
          columns: ["body"],
          query: "test",
          maxLength: 80,
        },
        mockContext,
      )) as { rows: Record<string, unknown>[] };

      expect((result.rows[0].body as string).length).toBe(83); // 80 + "..."
      expect((result.rows[0].body as string).endsWith("...")).toBe(true);
    });

    it("should return exists:false for nonexistent table", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Table 'testdb.nonexistent' doesn't exist"),
      );

      const tool = createFulltextExpandTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "nonexistent", columns: ["title"], query: "test" },
        mockContext,
      )) as { exists: boolean; table: string };

      expect(result.exists).toBe(false);
      expect(result.table).toBe("nonexistent");
    });

    it("should return success:false for generic query error", async () => {
      mockAdapter.executeReadQuery.mockRejectedValue(
        new Error("Can't find FULLTEXT index matching the column list"),
      );

      const tool = createFulltextExpandTool(
        mockAdapter as unknown as MySQLAdapter,
      );
      const result = (await tool.handler(
        { table: "articles", columns: ["title"], query: "test" },
        mockContext,
      )) as { success: boolean; error: string };

      expect(result.success).toBe(false);
      expect(result.error).toContain("FULLTEXT index");
    });
  });
});

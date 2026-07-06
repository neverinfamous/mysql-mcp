import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFulltextSearchTool } from "../search.js";
import type { MySQLAdapter } from "../../../../mysql-adapter/index.js";

describe("createFulltextSearchTool", () => {
  let mockAdapter: ReturnType<typeof vi.mocked<MySQLAdapter>>;
  let tool: ReturnType<typeof createFulltextSearchTool>;

  beforeEach(() => {
    mockAdapter = {
      executeReadQuery: vi.fn(),
      executeWriteQuery: vi.fn(),
      // add other methods if needed
    } as any;
    tool = createFulltextSearchTool(mockAdapter as unknown as MySQLAdapter);
  });

  it("should perform natural language mode search by default", async () => {
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ title: "MySQL", relevance: 1.2 }],
    });

    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL" },
      {} as any
    );

    expect(result.success).toBe(true);
    expect(result.data.rows).toEqual([{ title: "MySQL", relevance: 1.2 }]);
    expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
      "SELECT `title`, MATCH(`title`) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance FROM `articles` WHERE MATCH(`title`) AGAINST(? IN NATURAL LANGUAGE MODE) ORDER BY relevance DESC LIMIT 5",
      ["MySQL", "MySQL"]
    );
  });

  it("should handle boolean mode search", async () => {
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ title: "MySQL +Tutorial", relevance: 1.2 }],
    });

    const result = await tool.handler(
      { table: "articles", columns: ["title", "body"], query: "+MySQL", mode: "BOOLEAN" },
      {} as any
    );

    expect(result.success).toBe(true);
    expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
      "SELECT `title`, `body`, MATCH(`title`, `body`) AGAINST(? IN BOOLEAN MODE) as relevance FROM `articles` WHERE MATCH(`title`, `body`) AGAINST(? IN BOOLEAN MODE) ORDER BY relevance DESC LIMIT 5",
      ["+MySQL", "+MySQL"]
    );
  });

  it("should handle query expansion mode search", async () => {
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [] });

    await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", mode: "EXPANSION", limit: 10 },
      {} as any
    );

    expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
      "SELECT `title`, MATCH(`title`) AGAINST(? WITH QUERY EXPANSION) as relevance FROM `articles` WHERE MATCH(`title`) AGAINST(? WITH QUERY EXPANSION) ORDER BY relevance DESC LIMIT 10",
      ["MySQL", "MySQL"]
    );
  });

  it("should handle empty query with no results", async () => {
    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "" },
      {} as any
    );

    expect(result.success).toBe(true);
    expect(result.data.rows).toEqual([]);
    expect(mockAdapter.executeReadQuery).not.toHaveBeenCalled();
  });

  it("should handle pagination with valid cursor", async () => {
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: Array(5).fill({ title: "MySQL", relevance: 1.0 }),
    });

    const cursorData = Buffer.from(JSON.stringify({ offset: 5 })).toString("base64");
    
    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", cursor: cursorData },
      {} as any
    );

    expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
      expect.stringContaining("OFFSET 5"),
      ["MySQL", "MySQL"]
    );
    expect(result.data.nextCursor).toBeDefined();
  });

  it("should reject invalid cursor", async () => {
    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", cursor: "invalid-base64-json" },
      {} as any
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid cursor");
  });

  it("should include facets if requested", async () => {
    // 1st call: The actual search query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ title: "MySQL", relevance: 1.0 }],
    });
    // 2nd call: The total count query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ cnt: 100 }],
    });
    // 3rd call: Facet query for 'title'
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ cnt: 50 }],
    });

    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", includeFacets: true },
      {} as any
    );

    expect(result.data.facets).toEqual({
      total: 100,
      title: 50,
    });
  });

  it("should handle facet errors gracefully", async () => {
    // 1st call: The actual search query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ title: "MySQL", relevance: 1.0 }],
    });
    // 2nd call: The total count query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({
      rows: [{ cnt: 100 }],
    });
    // 3rd call: Facet query for 'title' (simulating missing fulltext index on individual column)
    mockAdapter.executeReadQuery.mockRejectedValueOnce(
      new Error("Can't find FULLTEXT index")
    );

    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", includeFacets: true },
      {} as any
    );

    expect(result.data.facets).toEqual({ total: 100 });
    expect(result.data.warnings).toContain("Facet skipped for 'title': Requires individual FULLTEXT index");
  });

  it("should handle common SQL errors like missing index or table", async () => {
    mockAdapter.executeReadQuery.mockRejectedValueOnce(
      new Error("Table 'articles' does not exist")
    );

    let result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL" },
      {} as any
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not exist");

    mockAdapter.executeReadQuery.mockRejectedValueOnce(
      new Error("Can't find FULLTEXT index matching the column list")
    );

    result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL" },
      {} as any
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("No FULLTEXT index found");
    
    mockAdapter.executeReadQuery.mockRejectedValueOnce(
      new Error("syntax error, unexpected")
    );

    result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL" },
      {} as any
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid search syntax");
  });
});

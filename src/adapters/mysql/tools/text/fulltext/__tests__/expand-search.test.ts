import { describe, it, expect, vi, beforeEach } from "vitest";
import { createFulltextExpandTool } from "../expand-search.js";
import type { MySQLAdapter } from "../../../../mysql-adapter/index.js";

describe("createFulltextExpandTool", () => {
  let mockAdapter: ReturnType<typeof vi.mocked<MySQLAdapter>>;
  let tool: ReturnType<typeof createFulltextExpandTool>;

  beforeEach(() => {
    mockAdapter = {
      executeReadQuery: vi.fn(),
    } as any;
    tool = createFulltextExpandTool(mockAdapter as unknown as MySQLAdapter);
  });

  it("should perform query expansion mode search", async () => {
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
      "SELECT `title`, MATCH(`title`) AGAINST(? WITH QUERY EXPANSION) as relevance FROM `articles` WHERE MATCH(`title`) AGAINST(? WITH QUERY EXPANSION) ORDER BY relevance DESC LIMIT 3",
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
      rows: Array(3).fill({ title: "MySQL", relevance: 1.0 }),
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
      { table: "articles", columns: ["title"], query: "MySQL", cursor: "invalid" },
      {} as any
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid cursor");
  });

  it("should include facets if requested", async () => {
    // 1st call: search query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ title: "MySQL", relevance: 1.0 }] });
    // 2nd call: total count query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ cnt: 10 }] });
    // 3rd call: Facet query
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ cnt: 5 }] });

    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", includeFacets: true },
      {} as any
    );

    expect(result.data.facets).toEqual({ total: 10, title: 5 });
  });

  it("should handle facet missing index warning", async () => {
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ title: "MySQL", relevance: 1.0 }] });
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ cnt: 10 }] });
    mockAdapter.executeReadQuery.mockRejectedValueOnce(new Error("Can't find FULLTEXT index"));

    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", includeFacets: true },
      {} as any
    );

    expect(result.data.facets).toBeUndefined();
    expect(result.data.warnings).toContain("Facet skipped for 'title': Requires individual FULLTEXT index");
  });

  it("should handle general facet error by throwing", async () => {
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ title: "MySQL", relevance: 1.0 }] });
    mockAdapter.executeReadQuery.mockResolvedValueOnce({ rows: [{ cnt: 10 }] });
    mockAdapter.executeReadQuery.mockRejectedValueOnce(new Error("Unknown fatal error"));

    const result = await tool.handler(
      { table: "articles", columns: ["title"], query: "MySQL", includeFacets: true },
      {} as any
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("Unknown fatal error");
  });

  it("should handle common SQL errors like missing index or table", async () => {
    mockAdapter.executeReadQuery.mockRejectedValueOnce(new Error("Table 'articles' does not exist"));

    let result = await tool.handler({ table: "articles", columns: ["title"], query: "MySQL" }, {} as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain("does not exist");

    mockAdapter.executeReadQuery.mockRejectedValueOnce(new Error("Can't find FULLTEXT index matching the column list"));

    result = await tool.handler({ table: "articles", columns: ["title"], query: "MySQL" }, {} as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain("No FULLTEXT index found");
    
    mockAdapter.executeReadQuery.mockRejectedValueOnce(new Error("syntax error, unexpected"));

    result = await tool.handler({ table: "articles", columns: ["title"], query: "MySQL" }, {} as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid search syntax");
  });
});

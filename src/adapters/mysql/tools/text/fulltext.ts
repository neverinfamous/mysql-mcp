/**
 * MySQL Text Tools - Fulltext Search
 *
 * FULLTEXT search and indexing tools.
 * 4 tools: fulltext_create, fulltext_search, fulltext_boolean, fulltext_expand.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { FulltextCreateSchema, FulltextSearchSchema } from "../../types.js";
import { z } from "zod";

export function createFulltextCreateTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_create",
    title: "MySQL Create FULLTEXT Index",
    description:
      "Create a FULLTEXT index on specified columns for fast text search.",
    group: "fulltext",
    inputSchema: FulltextCreateSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, columns, indexName } = FulltextCreateSchema.parse(params);

      const name = indexName ?? `ft_${table}_${columns.join("_")}`;
      const columnList = columns.map((c) => `\`${c}\``).join(", ");

      const sql = `CREATE FULLTEXT INDEX \`${name}\` ON \`${table}\` (${columnList})`;
      await adapter.executeQuery(sql);

      return { success: true, indexName: name, columns };
    },
  };
}

export function createFulltextSearchTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_search",
    title: "MySQL FULLTEXT Search",
    description: "Perform FULLTEXT search with relevance ranking.",
    group: "fulltext",
    inputSchema: FulltextSearchSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, columns, query, mode } =
        FulltextSearchSchema.parse(params);

      const columnList = columns.map((c) => `\`${c}\``).join(", ");
      let matchClause: string;

      switch (mode) {
        case "BOOLEAN":
          matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;
          break;
        case "EXPANSION":
          matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;
          break;
        default:
          matchClause = `MATCH(${columnList}) AGAINST(? IN NATURAL LANGUAGE MODE)`;
      }

      const sql = `SELECT *, ${matchClause} as relevance FROM \`${table}\` WHERE ${matchClause} ORDER BY relevance DESC`;
      const result = await adapter.executeReadQuery(sql, [query, query]);

      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

export function createFulltextBooleanTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    columns: z.array(z.string()),
    query: z.string().describe("Boolean search query with +, -, *, etc."),
  });

  return {
    name: "mysql_fulltext_boolean",
    title: "MySQL FULLTEXT Boolean",
    description:
      "Perform FULLTEXT search in BOOLEAN MODE with operators (+, -, *, etc.).",
    group: "fulltext",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, columns, query } = schema.parse(params);

      const columnList = columns.map((c) => `\`${c}\``).join(", ");
      const matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;

      const sql = `SELECT *, ${matchClause} as relevance FROM \`${table}\` WHERE ${matchClause}`;
      const result = await adapter.executeReadQuery(sql, [query, query]);

      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

export function createFulltextExpandTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    columns: z.array(z.string()),
    query: z.string().describe("Search query to expand"),
  });

  return {
    name: "mysql_fulltext_expand",
    title: "MySQL FULLTEXT Expand",
    description:
      "Perform FULLTEXT search WITH QUERY EXPANSION for finding related terms.",
    group: "fulltext",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, columns, query } = schema.parse(params);

      const columnList = columns.map((c) => `\`${c}\``).join(", ");
      const matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;

      const sql = `SELECT *, ${matchClause} as relevance FROM \`${table}\` WHERE ${matchClause} ORDER BY relevance DESC`;
      const result = await adapter.executeReadQuery(sql, [query, query]);

      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

/**
 * MySQL Text Tools - Fulltext Search
 *
 * FULLTEXT search and indexing tools.
 * 5 tools: fulltext_create, fulltext_drop, fulltext_search, fulltext_boolean, fulltext_expand.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  FulltextCreateSchema,
  FulltextCreateSchemaBase,
  FulltextSearchSchema,
  FulltextSearchSchemaBase,
} from "../../types.js";
import { z } from "zod";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";

/**
 * Check if an error is a MySQL duplicate key name error (ER_DUP_KEYNAME, code 1061)
 */
function isDuplicateKeyError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      (err as Error & { errno?: number }).errno === 1061 ||
      err.message.includes("Duplicate key name")
    );
  }
  return false;
}

/**
 * Check if an error is a MySQL can't drop key error (ER_CANT_DROP_FIELD_OR_KEY, code 1091)
 */
function isCantDropKeyError(err: unknown): boolean {
  if (err instanceof Error) {
    return (
      (err as Error & { errno?: number }).errno === 1091 ||
      err.message.includes("check that column/key exists")
    );
  }
  return false;
}

/**
 * Truncate string values in rows to maxLength if specified
 */
function truncateRowValues(
  rows: Record<string, unknown>[],
  columns: string[],
  maxLength?: number,
): Record<string, unknown>[] {
  if (maxLength === undefined || maxLength === null || maxLength <= 0)
    return rows;
  return rows.map((row) => {
    const truncated = { ...row };
    for (const col of columns) {
      const val = truncated[col];
      if (typeof val === "string" && val.length > maxLength) {
        truncated[col] = val.substring(0, maxLength) + "...";
      }
    }
    return truncated;
  });
}

export function createFulltextCreateTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_create",
    title: "MySQL Create FULLTEXT Index",
    description:
      "Create a FULLTEXT index on specified columns for fast text search.",
    group: "fulltext",
    inputSchema: FulltextCreateSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, columns, indexName } = FulltextCreateSchema.parse(params);

      const name = indexName ?? `ft_${table}_${columns.join("_")}`;
      const columnList = columns.map((c) => `\`${c}\``).join(", ");

      const sql = `CREATE FULLTEXT INDEX \`${name}\` ON \`${table}\` (${columnList})`;

      try {
        await adapter.executeQuery(sql);
      } catch (err: unknown) {
        if (isDuplicateKeyError(err)) {
          return {
            success: false,
            reason: `Index '${name}' already exists on table '${table}'`,
          };
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        throw err;
      }

      return { success: true, indexName: name, columns };
    },
  };
}

const FulltextDropSchema = z.object({
  table: z.string().describe("Table containing the index"),
  indexName: z.string().describe("Name of the FULLTEXT index to drop"),
});

export function createFulltextDropTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_fulltext_drop",
    title: "MySQL Drop FULLTEXT Index",
    description: "Drop a FULLTEXT index from a table.",
    group: "fulltext",
    inputSchema: FulltextDropSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, indexName } = FulltextDropSchema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(indexName, "index");

      const sql = `DROP INDEX \`${indexName}\` ON ${escapeQualifiedTable(table)}`;

      try {
        await adapter.executeQuery(sql);
      } catch (err: unknown) {
        if (isCantDropKeyError(err)) {
          return {
            success: false,
            reason: `Index '${indexName}' does not exist on table '${table}'`,
          };
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        throw err;
      }

      return { success: true, indexName, table };
    },
  };
}

const FulltextSearchWithTruncateSchema = FulltextSearchSchemaBase.extend({
  maxLength: z
    .number()
    .optional()
    .describe(
      "Optional max characters per text column in results. Truncates with '...' if exceeded.",
    ),
});

export function createFulltextSearchTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_search",
    title: "MySQL FULLTEXT Search",
    description: "Perform FULLTEXT search with relevance ranking.",
    group: "fulltext",
    inputSchema: FulltextSearchWithTruncateSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = FulltextSearchSchema.parse(params);
      const { table, columns, query, mode } = parsed;
      const maxLength = (params as Record<string, unknown>)["maxLength"] as
        | number
        | undefined;

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      for (const col of columns) {
        validateIdentifier(col, "column");
      }

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

      // Return only id, searched columns, and relevance for minimal payload
      const sql = `SELECT id, ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;

      try {
        const result = await adapter.executeReadQuery(sql, [query, query]);
        const rows = truncateRowValues(result.rows ?? [], columns, maxLength);
        return { rows, count: rows.length };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        return { success: false, error: msg };
      }
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
    maxLength: z
      .number()
      .optional()
      .describe(
        "Optional max characters per text column in results. Truncates with '...' if exceeded.",
      ),
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
      const { table, columns, query, maxLength } = schema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      for (const col of columns) {
        validateIdentifier(col, "column");
      }

      const columnList = columns.map((c) => `\`${c}\``).join(", ");
      const matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;

      // Return only id, searched columns, and relevance for minimal payload
      const sql = `SELECT id, ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause}`;

      try {
        const result = await adapter.executeReadQuery(sql, [query, query]);
        const rows = truncateRowValues(result.rows ?? [], columns, maxLength);
        return { rows, count: rows.length };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        return { success: false, error: msg };
      }
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
    maxLength: z
      .number()
      .optional()
      .describe(
        "Optional max characters per text column in results. Truncates with '...' if exceeded.",
      ),
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
      const { table, columns, query, maxLength } = schema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      for (const col of columns) {
        validateIdentifier(col, "column");
      }

      const columnList = columns.map((c) => `\`${c}\``).join(", ");
      const matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;

      // Return only id, searched columns, and relevance for minimal payload
      const sql = `SELECT id, ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;

      try {
        const result = await adapter.executeReadQuery(sql, [query, query]);
        const rows = truncateRowValues(result.rows ?? [], columns, maxLength);
        return { rows, count: rows.length };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { exists: false, table };
        }
        return { success: false, error: msg };
      }
    },
  };
}

/**
 * MySQL Text Tools - Fulltext Search
 *
 * FULLTEXT search and indexing tools.
 * 5 tools: fulltext_create, fulltext_drop, fulltext_search, fulltext_boolean, fulltext_expand.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ValidationError } from "../../../../types/index.js";
import { sanitizeFulltextQuery } from "./fulltext-helpers.js";
import {
  FulltextCreateSchema,
  FulltextCreateSchemaBase,
  FulltextSearchSchema,
  FulltextSearchSchemaBase,
  FulltextDropSchema,
  FulltextDropSchemaBase,
  FulltextBooleanSchema,
  FulltextBooleanSchemaBase,
  FulltextExpandSchema,
  FulltextExpandSchemaBase,
} from "../../schemas/index.js";
import { ZodError } from "zod";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../core/error-helpers.js";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";
import {
  WRITE,
  DESTRUCTIVE,
  READ_ONLY,
} from "../../../../utils/annotations.js";

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
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, columns, indexName } =
          FulltextCreateSchema.parse(params);

        const name = indexName ?? `ft_${table}_${columns.join("_")}`;
        const columnList = columns.map((c) => `\`${c}\``).join(", ");

        const sql = `CREATE FULLTEXT INDEX \`${name}\` ON \`${table}\` (${columnList})`;

        try {
          await adapter.executeQuery(sql);
        } catch (err: unknown) {
          if (isDuplicateKeyError(err)) {
            return formatHandlerErrorResponse(
              new Error(`Index '${name}' already exists on table '${table}'`),
            );
          }
          const msg = err instanceof Error ? err.message : String(err);
          // Distinguish column-not-found (errno 1072) from table-not-found
          if (
            (err as Error & { errno?: number }).errno === 1072 ||
            msg.includes("Key column") ||
            msg.includes("Column '")
          ) {
            return formatHandlerErrorResponse(new Error(msg));
          }
          if (msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();
        return withTokenEstimate({
          success: true,
          data: { indexName: name, columns },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createFulltextDropTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_fulltext_drop",
    title: "MySQL Drop FULLTEXT Index",
    description: "Drop a FULLTEXT index from a table.",
    group: "fulltext",
    inputSchema: FulltextDropSchemaBase,
    requiredScopes: ["write"],
    annotations: DESTRUCTIVE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, indexName } = FulltextDropSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(indexName, "index");

        const sql = `DROP INDEX \`${indexName}\` ON ${escapeQualifiedTable(table)}`;

        try {
          await adapter.executeQuery(sql);
        } catch (err: unknown) {
          if (isCantDropKeyError(err)) {
            return formatHandlerErrorResponse(
              new Error(
                `Index '${indexName}' does not exist on table '${table}'`,
              ),
            );
          }
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          return formatHandlerErrorResponse(err);
        }

        adapter.clearSchemaCache();
        return withTokenEstimate({
          success: true,
          data: { indexName, table },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
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
    inputSchema: FulltextSearchSchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = FulltextSearchSchema.parse(params);
        const { table, columns, query, mode, maxLength, limit, includeFacets, cursor } = parsed;

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }

        const sanitizedQuery = sanitizeFulltextQuery(query);
        if (!sanitizedQuery) {
          return withTokenEstimate({
            success: true,
            data: { rows: [], count: 0 },
          });
        }

        let offset = 0;
        if (cursor) {
          try {
            const cursorData = JSON.parse(
              Buffer.from(cursor, "base64").toString("utf8"),
            ) as Record<string, unknown>;
            if (typeof cursorData["offset"] === "number") {
              offset = cursorData["offset"];
            }
          } catch {
            throw new ValidationError("Invalid cursor format", {
              suggestion: "Use the nextCursor value returned from a previous query.",
            });
          }
        }

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        let matchClause: string;
        let matchModeModifier: string;

        switch (mode) {
          case "BOOLEAN":
            matchModeModifier = "IN BOOLEAN MODE";
            matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;
            break;
          case "EXPANSION":
            matchModeModifier = "WITH QUERY EXPANSION";
            matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;
            break;
          default:
            matchModeModifier = "IN NATURAL LANGUAGE MODE";
            matchClause = `MATCH(${columnList}) AGAINST(? IN NATURAL LANGUAGE MODE)`;
        }

        // Return searched columns and relevance for minimal payload
        let sql = `SELECT ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [sanitizedQuery, sanitizedQuery];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 5;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;
        if (offset > 0) {
          sql += ` OFFSET ${offset}`;
        }

        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const rawData = result.rows ?? [];
          const data = truncateRowValues(
            rawData,
            columns,
            maxLength ?? 250,
          );

          let nextCursor: string | undefined;
          if (data.length === finalLimit) {
            nextCursor = Buffer.from(
              JSON.stringify({ offset: offset + finalLimit }),
            ).toString("base64");
          }

          let facets: Record<string, number> | undefined;
          let warnings: string[] | undefined;
          if (includeFacets && data.length > 0) {
            facets = {};
            for (const col of columns) {
              const facetSql = `SELECT COUNT(*) AS cnt FROM ${escapeQualifiedTable(table)} WHERE MATCH(\`${col}\`) AGAINST(? ${matchModeModifier})`;
              try {
                const facetResult = await adapter.executeReadQuery(facetSql, [sanitizedQuery]);
                const firstRow = facetResult.rows?.[0];
                facets[col] = Number(firstRow?.["cnt"] ?? 0);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("FULLTEXT index") || msg.includes("ER_FT_MATCHING_KEY_NOT_FOUND")) {
                  warnings ??= [];
                  warnings.push(`Facet skipped for '${col}': Requires individual FULLTEXT index`);
                } else {
                  throw err;
                }
              }
            }
            if (Object.keys(facets).length === 0) facets = undefined;
          }

          return withTokenEstimate({
            success: true,
            data: {
              rows: data,
              count: data.length,
              ...(nextCursor ? { nextCursor } : {}),
              ...(facets ? { facets } : {}),
              ...(warnings ? { warnings } : {}),
            },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          if (
            msg.includes("Can't find FULLTEXT index matching the column list")
          ) {
            return formatHandlerErrorResponse(
              new Error("No FULLTEXT index found for the specified columns"),
            );
          }
          if (msg.includes("syntax error, unexpected")) {
            return formatHandlerErrorResponse(
              new Error(`Invalid search syntax: ${query}`),
            );
          }
          return formatHandlerErrorResponse(error);
        }
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createFulltextBooleanTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_boolean",
    title: "MySQL FULLTEXT Boolean",
    description:
      "Perform FULLTEXT search in BOOLEAN MODE with operators (+, -, *, etc.).",
    group: "fulltext",
    inputSchema: FulltextBooleanSchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, columns, query, maxLength, limit, includeFacets, cursor } =
          FulltextBooleanSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }

        const sanitizedQuery = sanitizeFulltextQuery(query);
        if (!sanitizedQuery) {
          return withTokenEstimate({
            success: true,
            data: { rows: [], count: 0 },
          });
        }

        let offset = 0;
        if (cursor) {
          try {
            const cursorData = JSON.parse(
              Buffer.from(cursor, "base64").toString("utf8"),
            ) as Record<string, unknown>;
            if (typeof cursorData["offset"] === "number") {
              offset = cursorData["offset"];
            }
          } catch {
            throw new ValidationError("Invalid cursor format", {
              suggestion: "Use the nextCursor value returned from a previous query.",
            });
          }
        }

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        const matchModeModifier = "IN BOOLEAN MODE";
        const matchClause = `MATCH(${columnList}) AGAINST(? ${matchModeModifier})`;

        // Return searched columns and relevance for minimal payload
        let sql = `SELECT ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [sanitizedQuery, sanitizedQuery];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 5;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;
        if (offset > 0) {
          sql += ` OFFSET ${offset}`;
        }

        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const rawData = result.rows ?? [];
          const data = truncateRowValues(
            rawData,
            columns,
            maxLength ?? 250,
          );

          let nextCursor: string | undefined;
          if (data.length === finalLimit) {
            nextCursor = Buffer.from(
              JSON.stringify({ offset: offset + finalLimit }),
            ).toString("base64");
          }

          let facets: Record<string, number> | undefined;
          let warnings: string[] | undefined;
          if (includeFacets && data.length > 0) {
            facets = {};
            for (const col of columns) {
              const facetSql = `SELECT COUNT(*) AS cnt FROM ${escapeQualifiedTable(table)} WHERE MATCH(\`${col}\`) AGAINST(? ${matchModeModifier})`;
              try {
                const facetResult = await adapter.executeReadQuery(facetSql, [sanitizedQuery]);
                const firstRow = facetResult.rows?.[0];
                facets[col] = Number(firstRow?.["cnt"] ?? 0);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("FULLTEXT index") || msg.includes("ER_FT_MATCHING_KEY_NOT_FOUND")) {
                  warnings ??= [];
                  warnings.push(`Facet skipped for '${col}': Requires individual FULLTEXT index`);
                } else {
                  throw err;
                }
              }
            }
            if (Object.keys(facets).length === 0) facets = undefined;
          }

          return withTokenEstimate({
            success: true,
            data: {
              rows: data,
              count: data.length,
              ...(nextCursor ? { nextCursor } : {}),
              ...(facets ? { facets } : {}),
              ...(warnings ? { warnings } : {}),
            },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          if (
            msg.includes("Can't find FULLTEXT index matching the column list")
          ) {
            return formatHandlerErrorResponse(
              new Error("No FULLTEXT index found for the specified columns"),
            );
          }
          if (msg.includes("syntax error, unexpected")) {
            return formatHandlerErrorResponse(
              new Error(`Invalid search syntax: ${query}`),
            );
          }
          return formatHandlerErrorResponse(error);
        }
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createFulltextExpandTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_fulltext_expand",
    title: "MySQL FULLTEXT Expand",
    description:
      "Perform FULLTEXT search WITH QUERY EXPANSION for finding related terms.",
    group: "fulltext",
    inputSchema: FulltextExpandSchemaBase,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, columns, query, maxLength, limit, includeFacets, cursor } =
          FulltextExpandSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }

        const sanitizedQuery = sanitizeFulltextQuery(query);
        if (!sanitizedQuery) {
          return withTokenEstimate({
            success: true,
            data: { rows: [], count: 0 },
          });
        }

        let offset = 0;
        if (cursor) {
          try {
            const cursorData = JSON.parse(
              Buffer.from(cursor, "base64").toString("utf8"),
            ) as Record<string, unknown>;
            if (typeof cursorData["offset"] === "number") {
              offset = cursorData["offset"];
            }
          } catch {
            throw new ValidationError("Invalid cursor format", {
              suggestion: "Use the nextCursor value returned from a previous query.",
            });
          }
        }

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        const matchModeModifier = "WITH QUERY EXPANSION";
        const matchClause = `MATCH(${columnList}) AGAINST(? ${matchModeModifier})`;

        // Return searched columns and relevance for minimal payload
        let sql = `SELECT ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [sanitizedQuery, sanitizedQuery];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 3;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;
        if (offset > 0) {
          sql += ` OFFSET ${offset}`;
        }

        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const rawData = result.rows ?? [];
          const data = truncateRowValues(
            rawData,
            columns,
            maxLength ?? 250,
          );

          let nextCursor: string | undefined;
          if (data.length === finalLimit) {
            nextCursor = Buffer.from(
              JSON.stringify({ offset: offset + finalLimit }),
            ).toString("base64");
          }

          let facets: Record<string, number> | undefined;
          let warnings: string[] | undefined;
          if (includeFacets && data.length > 0) {
            facets = {};
            for (const col of columns) {
              const facetSql = `SELECT COUNT(*) AS cnt FROM ${escapeQualifiedTable(table)} WHERE MATCH(\`${col}\`) AGAINST(? ${matchModeModifier})`;
              try {
                const facetResult = await adapter.executeReadQuery(facetSql, [sanitizedQuery]);
                const firstRow = facetResult.rows?.[0];
                facets[col] = Number(firstRow?.["cnt"] ?? 0);
              } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                if (msg.includes("FULLTEXT index") || msg.includes("ER_FT_MATCHING_KEY_NOT_FOUND")) {
                  warnings ??= [];
                  warnings.push(`Facet skipped for '${col}': Requires individual FULLTEXT index`);
                } else {
                  throw err;
                }
              }
            }
            if (Object.keys(facets).length === 0) facets = undefined;
          }

          return withTokenEstimate({
            success: true,
            data: {
              rows: data,
              count: data.length,
              ...(nextCursor ? { nextCursor } : {}),
              ...(facets ? { facets } : {}),
              ...(warnings ? { warnings } : {}),
            },
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("doesn't exist")) {
            return formatHandlerErrorResponse(
              new Error(`Table '${table}' does not exist`),
            );
          }
          if (
            msg.includes("Can't find FULLTEXT index matching the column list")
          ) {
            return formatHandlerErrorResponse(
              new Error("No FULLTEXT index found for the specified columns"),
            );
          }
          if (msg.includes("syntax error, unexpected")) {
            return formatHandlerErrorResponse(
              new Error(`Invalid search syntax: ${query}`),
            );
          }
          return formatHandlerErrorResponse(error);
        }
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

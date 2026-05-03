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
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
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
        const response = { success: true, data: { indexName: name, columns } };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
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
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
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
        const response = { success: true, data: { indexName, table } };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
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
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = FulltextSearchSchema.parse(params);
        const { table, columns, query, mode, maxLength, limit } = parsed;

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

        // Return searched columns and relevance for minimal payload
        let sql = `SELECT ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [query, query];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 5;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;
        
        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const data = truncateRowValues(result.rows ?? [], columns, maxLength ?? 250);
          const response = { success: true, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
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
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, columns, query, maxLength, limit } =
          FulltextBooleanSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        const matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;

        // Return searched columns and relevance for minimal payload
        let sql = `SELECT ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [query, query];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 5;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;

        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const data = truncateRowValues(result.rows ?? [], columns, maxLength ?? 250);
          const response = { success: true, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
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
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, columns, query, maxLength, limit } =
          FulltextExpandSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        for (const col of columns) {
          validateIdentifier(col, "column");
        }

        const columnList = columns.map((c) => `\`${c}\``).join(", ");
        const matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;

        // Return searched columns and relevance for minimal payload
        let sql = `SELECT ${columnList}, ${matchClause} as relevance FROM ${escapeQualifiedTable(table)} WHERE ${matchClause} ORDER BY relevance DESC`;
        const queryArgs: (string | number)[] = [query, query];

        const finalLimit = limit !== undefined && limit > 0 ? limit : 3;
        sql += ` LIMIT ${Math.floor(finalLimit)}`;

        try {
          const result = await adapter.executeReadQuery(sql, queryArgs);
          const data = truncateRowValues(result.rows ?? [], columns, maxLength ?? 250);
          const response = { success: true, data };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
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

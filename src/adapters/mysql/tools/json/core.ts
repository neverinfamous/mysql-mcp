/**
 * MySQL JSON Tools - Core Operations
 *
 * Basic JSON operations: extract, set, insert, replace, remove, contains, keys, array append.
 * 8 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ZodError } from "zod";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import {
  JsonExtractSchema,
  JsonExtractSchemaBase,
  JsonExtractOutputSchema,
  JsonSetSchema,
  JsonSetSchemaBase,
  JsonSetOutputSchema,
  JsonInsertSchema,
  JsonInsertSchemaBase,
  JsonInsertOutputSchema,
  JsonReplaceSchema,
  JsonReplaceSchemaBase,
  JsonReplaceOutputSchema,
  JsonRemoveSchema,
  JsonRemoveSchemaBase,
  JsonRemoveOutputSchema,
  JsonContainsSchema,
  JsonContainsSchemaBase,
  JsonContainsOutputSchema,
  JsonKeysSchema,
  JsonKeysSchemaBase,
  JsonKeysOutputSchema,
  JsonArrayAppendSchema,
  JsonArrayAppendSchemaBase,
  JsonArrayAppendOutputSchema,
} from "../../schemas/index.js";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  validateWhereClause,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

/**
 * Export all core JSON tool creation functions
 */

/**
 * Validate and normalize a value for JSON storage.
 * - If the value is already valid JSON string representation, return as-is
 * - If the value is a bare string (not valid JSON), auto-wrap it as a JSON string
 * - If the value is any other type, serialize it to JSON
 *
 * This makes the MCP interface more user-friendly by accepting bare strings
 * like "article" and automatically converting them to JSON strings '"article"'.
 */
function validateJsonString(value: unknown): string {
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      // Bare string - wrap it as a JSON string
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

export function createJsonExtractTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_extract",
    title: "MySQL JSON Extract",
    description:
      "Extract values from JSON columns using JSON path expressions.",
    group: "json",
    inputSchema: JsonExtractSchemaBase,
    outputSchema: JsonExtractOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, where, limit } =
          JsonExtractSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        if (where) {
          validateWhereClause(where);
        }

        let sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as extracted_value FROM ${escapeQualifiedTable(table)}`;
        const queryParams: unknown[] = [path];

        if (where) {
          sql += ` WHERE ${where}`;
        }

        if (limit !== undefined && limit !== null) {
          sql += ` LIMIT ${limit}`;
        }

        const result = await adapter.executeReadQuery(sql, queryParams);
        return withTokenEstimate({
          success: true,
          data: { rows: result.rows, count: result.rows?.length ?? 0 },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonSetTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_set",
    title: "MySQL JSON Set",
    description: "Set or update values in JSON columns at specified paths.",
    group: "json",
    inputSchema: JsonSetSchemaBase,
    outputSchema: JsonSetOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, value, where } =
          JsonSetSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        return withTokenEstimate({
          success: true,
          data: { rowsAffected: result.rowsAffected },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonInsertTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_insert",
    title: "MySQL JSON Insert",
    description:
      "Insert values into JSON columns only if the path does not exist.",
    group: "json",
    inputSchema: JsonInsertSchemaBase,
    outputSchema: JsonInsertOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, value, where } =
          JsonInsertSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Check if path already exists before insert
        const checkSql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as existing_value FROM ${escapeQualifiedTable(table)} WHERE ${where}`;
        const checkResult = await adapter.executeReadQuery(checkSql, [path]);
        const pathExists =
          checkResult.rows?.[0]?.["existing_value"] !== null &&
          checkResult.rows?.[0]?.["existing_value"] !== undefined;

        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_INSERT(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);

        const response = pathExists
          ? {
              success: true as const,
              data: {
                rowsAffected: result.rowsAffected,
                changed: false,
                suggestion:
                  "Path already exists; value was not modified (JSON_INSERT only inserts new paths)",
              },
            }
          : {
              success: true as const,
              data: {
                rowsAffected: result.rowsAffected,
                changed: true,
              },
            };
        return withTokenEstimate(response);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonReplaceTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_replace",
    title: "MySQL JSON Replace",
    description: "Replace values in JSON columns only if the path exists.",
    group: "json",
    inputSchema: JsonReplaceSchemaBase,
    outputSchema: JsonReplaceOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, value, where } =
          JsonReplaceSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_REPLACE(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        return withTokenEstimate({
          success: true,
          data: { rowsAffected: result.rowsAffected },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonRemoveTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_remove",
    title: "MySQL JSON Remove",
    description: "Remove values from JSON columns at specified paths.",
    group: "json",
    inputSchema: JsonRemoveSchemaBase,
    outputSchema: JsonRemoveOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, paths, where } = JsonRemoveSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        const pathPlaceholders = paths.map(() => "?").join(", ");
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_REMOVE(\`${column}\`, ${pathPlaceholders}) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql, paths);
        return withTokenEstimate({
          success: true,
          data: { rowsAffected: result.rowsAffected },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonContainsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_contains",
    title: "MySQL JSON Contains",
    description: "Find rows where JSON column contains a specified value.",
    group: "json",
    inputSchema: JsonContainsSchemaBase,
    outputSchema: JsonContainsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, value, path, where, limit } =
          JsonContainsSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        if (where) {
          validateWhereClause(where);
        }

        // JSON_CONTAINS expects the value to be a valid JSON document
        // We ensure strict validation so that strings must be quoted (e.g. '"green"')
        const jsonValue = validateJsonString(value);
        let sql: string;
        const queryParams: unknown[] = [jsonValue];

        const whereClause = where ? ` AND ${where}` : "";
        const limitClause =
          limit !== undefined && limit !== null ? ` LIMIT ${limit}` : "";

        if (path) {
          sql = `SELECT id, \`${column}\` FROM ${escapeQualifiedTable(table)} WHERE JSON_CONTAINS(\`${column}\`, ?, ?)${whereClause}${limitClause}`;
          queryParams.push(path);
        } else {
          sql = `SELECT id, \`${column}\` FROM ${escapeQualifiedTable(table)} WHERE JSON_CONTAINS(\`${column}\`, ?)${whereClause}${limitClause}`;
        }

        const result = await adapter.executeReadQuery(sql, queryParams);
        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonKeysTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_keys",
    title: "MySQL JSON Keys",
    description: "Get the keys of a JSON object at the specified path.",
    group: "json",
    inputSchema: JsonKeysSchemaBase,
    outputSchema: JsonKeysOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, where, limit } =
          JsonKeysSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        if (where) {
          validateWhereClause(where);
        }

        const jsonPath = path ?? "$";
        const whereClause = where ? `WHERE ${where}` : "";
        const limitClause =
          limit !== undefined && limit !== null ? ` LIMIT ${limit}` : "";

        const sql = `SELECT JSON_KEYS(\`${column}\`, ?) as json_keys FROM ${escapeQualifiedTable(table)} ${whereClause} HAVING json_keys IS NOT NULL${limitClause}`;

        const result = await adapter.executeReadQuery(sql, [jsonPath]);
        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonArrayAppendTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_json_array_append",
    title: "MySQL JSON Array Append",
    description: "Append a value to a JSON array at the specified path.",
    group: "json",
    inputSchema: JsonArrayAppendSchemaBase,
    outputSchema: JsonArrayAppendOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, value, where } =
          JsonArrayAppendSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_ARRAY_APPEND(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        return withTokenEstimate({
          success: true,
          data: { rowsAffected: result.rowsAffected },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(
            new Error("Table or column does not exist"),
          );
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

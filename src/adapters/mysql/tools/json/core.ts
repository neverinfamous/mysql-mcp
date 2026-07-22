/**
 * MySQL JSON Tools - Core Operations
 *
 * Basic JSON operations: extract, set, insert, replace, remove, contains, keys, array append.
 * 8 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import { escape } from "mysql2";
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

        let sql = `SELECT CASE WHEN JSON_VALID(CAST(\`${column}\` AS CHAR)) THEN JSON_EXTRACT(CAST(\`${column}\` AS CHAR), ${escape(path)}) ELSE NULL END as extracted_value FROM ${escapeQualifiedTable(table)}`;

        if (where) {
          sql += ` WHERE ${where}`;
        }

        const appliedLimit = limit ?? 50;
        sql += ` LIMIT ${appliedLimit}`;

        const result = await adapter.executeReadQuery(sql);
        return withTokenEstimate({
          success: true,
          data: { rows: result.rows, count: result.rows?.length ?? 0 },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_extract" });
        }
        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_extract" });
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

        // Use CAST(CONVERT(? USING utf8mb4) AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const jsonValue = validateJsonString(value);
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(COALESCE(\`${column}\`, '{}'), ${escape(path)}, CAST(CONVERT(${escape(jsonValue)} USING utf8mb4) AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql);
        return withTokenEstimate({
          success: true,
          data: { rowsAffected: result.rowsAffected },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_set" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_set" });
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
        const checkSql = `SELECT SUM(CASE WHEN JSON_VALID(CAST(\`${column}\` AS CHAR)) THEN JSON_CONTAINS_PATH(CAST(\`${column}\` AS CHAR), 'one', ${escape(path)}) ELSE 0 END) as existing_paths, COUNT(*) as total_rows FROM ${escapeQualifiedTable(table)} WHERE ${where}`;
        const checkResult = await adapter.executeReadQuery(checkSql);
        const existingPaths = Number(checkResult.rows?.[0]?.["existing_paths"] ?? 0);
        const totalRows = Number(checkResult.rows?.[0]?.["total_rows"] ?? 0);

        // Use CAST(CONVERT(? USING utf8mb4) AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const jsonValue = validateJsonString(value);
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_INSERT(COALESCE(\`${column}\`, '{}'), ${escape(path)}, CAST(CONVERT(${escape(jsonValue)} USING utf8mb4) AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql);

        const response = totalRows === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: 0,
                changed: false,
                suggestion: "No rows matched the WHERE clause",
              },
            }
          : existingPaths === totalRows
          ? {
              success: true as const,
              data: {
                rowsAffected: result.rowsAffected,
                changed: false,
                suggestion:
                  "Path already exists in all matched rows; value was not modified (JSON_INSERT only inserts new paths)",
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
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_insert" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_insert" });
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

        // Check if path exists before replace
        const checkSql = `SELECT SUM(CASE WHEN JSON_VALID(CAST(\`${column}\` AS CHAR)) THEN JSON_CONTAINS_PATH(CAST(\`${column}\` AS CHAR), 'one', ${escape(path)}) ELSE 0 END) as existing_paths, COUNT(*) as total_rows FROM ${escapeQualifiedTable(table)} WHERE ${where}`;
        const checkResult = await adapter.executeReadQuery(checkSql);
        const existingPaths = Number(checkResult.rows?.[0]?.["existing_paths"] ?? 0);
        const totalRows = Number(checkResult.rows?.[0]?.["total_rows"] ?? 0);

        // Use CAST(CONVERT(? USING utf8mb4) AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const jsonValue = validateJsonString(value);
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_REPLACE(\`${column}\`, ${escape(path)}, CAST(CONVERT(${escape(jsonValue)} USING utf8mb4) AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql);

        const response = totalRows === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: 0,
                changed: false,
                suggestion: "No rows matched the WHERE clause",
              },
            }
          : existingPaths === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: result.rowsAffected,
                changed: false,
                suggestion:
                  "Path does not exist in any matched rows; value was not modified (JSON_REPLACE only updates existing paths)",
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
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_replace" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_replace" });
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

        const pathArgs = paths.map(p => escape(p)).join(", ");

        // Check if at least one path exists before remove
        const checkSql = `SELECT SUM(CASE WHEN JSON_VALID(CAST(\`${column}\` AS CHAR)) THEN JSON_CONTAINS_PATH(CAST(\`${column}\` AS CHAR), 'one', ${pathArgs}) ELSE 0 END) as existing_paths, COUNT(*) as total_rows FROM ${escapeQualifiedTable(table)} WHERE ${where}`;
        const checkResult = await adapter.executeReadQuery(checkSql);
        const existingPaths = Number(checkResult.rows?.[0]?.["existing_paths"] ?? 0);
        const totalRows = Number(checkResult.rows?.[0]?.["total_rows"] ?? 0);

        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_REMOVE(\`${column}\`, ${pathArgs}) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql);

        const response = totalRows === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: 0,
                changed: false,
                suggestion: "No rows matched the WHERE clause",
              },
            }
          : existingPaths === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: result.rowsAffected,
                changed: false,
                suggestion:
                  "None of the specified paths exist in any matched rows; values were not removed",
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
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_remove" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_remove" });
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

        const whereClause = where ? ` AND ${where}` : "";
        const limitClause = ` LIMIT ${limit ?? 50}`;

        if (path) {
          sql = `SELECT * FROM ${escapeQualifiedTable(table)} WHERE JSON_VALID(CAST(\`${column}\` AS CHAR)) = 1 AND JSON_CONTAINS(CAST(\`${column}\` AS CHAR), ${escape(jsonValue)}, ${escape(path)})${whereClause}${limitClause}`;
        } else {
          sql = `SELECT * FROM ${escapeQualifiedTable(table)} WHERE JSON_VALID(CAST(\`${column}\` AS CHAR)) = 1 AND JSON_CONTAINS(CAST(\`${column}\` AS CHAR), ${escape(jsonValue)})${whereClause}${limitClause}`;
        }

        const result = await adapter.executeReadQuery(sql);
        return withTokenEstimate({
          success: true,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_contains" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_contains" });
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
        const { table, column, path, where } =
          JsonKeysSchema.parse(params);

        // Validate inputs
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        if (where) {
          validateWhereClause(where);
        }

        const jsonPath = path ?? "$";
        const whereClause = where ? `WHERE ${where}` : "";

        // This tool only returns keys for a single document, so we strictly limit to 1
        // to avoid transferring unused rows over the network (context exhaustion prevention).
        const sql = `SELECT CASE WHEN JSON_VALID(CAST(\`${column}\` AS CHAR)) THEN JSON_KEYS(CAST(\`${column}\` AS CHAR), ${escape(jsonPath)}) ELSE NULL END as json_keys FROM ${escapeQualifiedTable(table)} ${whereClause} HAVING json_keys IS NOT NULL LIMIT 1`;

        const result = await adapter.executeReadQuery(sql);
        
        let keys: string[] | null = null;
        let suggestion: string | undefined = undefined;

        const rawKeys = result.rows?.[0]?.["json_keys"];
        if (rawKeys !== undefined && rawKeys !== null) {
          if (typeof rawKeys === "string") {
            const parsed = JSON.parse(rawKeys) as unknown;
            if (Array.isArray(parsed)) {
              keys = parsed.map(String);
            }
          } else if (Array.isArray(rawKeys)) {
            keys = rawKeys.map(String);
          }
        } else {
          suggestion = "No rows matched the WHERE clause or no rows contained a valid JSON object at the specified path";
        }
        
        return withTokenEstimate({
          success: true,
          data: { keys, suggestion },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_keys" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_keys" });
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

        // Check if path exists before append
        const checkSql = `SELECT SUM(CASE WHEN JSON_VALID(CAST(\`${column}\` AS CHAR)) THEN JSON_CONTAINS_PATH(CAST(\`${column}\` AS CHAR), 'one', ${escape(path)}) ELSE 0 END) as existing_paths, COUNT(*) as total_rows FROM ${escapeQualifiedTable(table)} WHERE ${where}`;
        const checkResult = await adapter.executeReadQuery(checkSql);
        const existingPaths = Number(checkResult.rows?.[0]?.["existing_paths"] ?? 0);
        const totalRows = Number(checkResult.rows?.[0]?.["total_rows"] ?? 0);

        // Use CAST(CONVERT(? USING utf8mb4) AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const jsonValue = validateJsonString(value);
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_ARRAY_APPEND(\`${column}\`, ${escape(path)}, CAST(CONVERT(${escape(jsonValue)} USING utf8mb4) AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql);

        const response = totalRows === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: 0,
                changed: false,
                suggestion: "No rows matched the WHERE clause",
              },
            }
          : existingPaths === 0
          ? {
              success: true as const,
              data: {
                rowsAffected: result.rowsAffected,
                changed: false,
                suggestion:
                  "Path does not exist in any matched rows; value was not appended (JSON_ARRAY_APPEND requires the target path to exist)",
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
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_array_append" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_array_append" });
      }
    },
  };
}

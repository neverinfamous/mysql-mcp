/**
 * MySQL JSON Tools - Core Operations
 *
 * Basic JSON operations: extract, set, insert, replace, remove, contains, keys, array append.
 * 8 tools total.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  JsonExtractSchema,
  JsonSetSchema,
  JsonContainsSchema,
  JsonKeysSchema,
} from "../../types.js";
import { z } from "zod";
import {
  validateIdentifier,
  validateQualifiedIdentifier,
  validateWhereClause,
  escapeQualifiedTable,
} from "../../../../utils/validators.js";

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
    inputSchema: JsonExtractSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, where } = JsonExtractSchema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      if (where) {
        validateWhereClause(where);
      }

      try {
        let sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as extracted_value FROM ${escapeQualifiedTable(table)}`;
        const queryParams: unknown[] = [path];

        if (where) {
          sql += ` WHERE ${where}`;
        }

        const result = await adapter.executeReadQuery(sql, queryParams);
        return { rows: result.rows };
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

export function createJsonSetTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_set",
    title: "MySQL JSON Set",
    description: "Set or update values in JSON columns at specified paths.",
    group: "json",
    inputSchema: JsonSetSchema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, value, where } = JsonSetSchema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateWhereClause(where);

      try {
        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        return { rowsAffected: result.rowsAffected };
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

export function createJsonInsertTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    column: z.string(),
    path: z.string(),
    value: z.unknown(),
    where: z.string(),
  });

  return {
    name: "mysql_json_insert",
    title: "MySQL JSON Insert",
    description:
      "Insert values into JSON columns only if the path does not exist.",
    group: "json",
    inputSchema: schema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, value, where } = schema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateWhereClause(where);

      try {
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

        if (pathExists) {
          return {
            rowsAffected: result.rowsAffected,
            changed: false,
            note: "Path already exists; value was not modified (JSON_INSERT only inserts new paths)",
          };
        }
        return { rowsAffected: result.rowsAffected, changed: true };
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

export function createJsonReplaceTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    column: z.string(),
    path: z.string(),
    value: z.unknown(),
    where: z.string(),
  });

  return {
    name: "mysql_json_replace",
    title: "MySQL JSON Replace",
    description: "Replace values in JSON columns only if the path exists.",
    group: "json",
    inputSchema: schema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, value, where } = schema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateWhereClause(where);

      try {
        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_REPLACE(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        return { rowsAffected: result.rowsAffected };
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

export function createJsonRemoveTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    column: z.string(),
    paths: z.array(z.string()),
    where: z.string(),
  });

  return {
    name: "mysql_json_remove",
    title: "MySQL JSON Remove",
    description: "Remove values from JSON columns at specified paths.",
    group: "json",
    inputSchema: schema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, paths, where } = schema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateWhereClause(where);

      try {
        const pathPlaceholders = paths.map(() => "?").join(", ");
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_REMOVE(\`${column}\`, ${pathPlaceholders}) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql, paths);
        return { rowsAffected: result.rowsAffected };
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

export function createJsonContainsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_contains",
    title: "MySQL JSON Contains",
    description: "Find rows where JSON column contains a specified value.",
    group: "json",
    inputSchema: JsonContainsSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, value, path } = JsonContainsSchema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");

      try {
        // JSON_CONTAINS expects the value to be a valid JSON document
        // We ensure strict validation so that strings must be quoted (e.g. '"green"')
        const jsonValue = validateJsonString(value);
        let sql: string;
        const queryParams: unknown[] = [jsonValue];

        if (path) {
          sql = `SELECT id, \`${column}\` FROM ${escapeQualifiedTable(table)} WHERE JSON_CONTAINS(\`${column}\`, ?, ?)`;
          queryParams.push(path);
        } else {
          sql = `SELECT id, \`${column}\` FROM ${escapeQualifiedTable(table)} WHERE JSON_CONTAINS(\`${column}\`, ?)`;
        }

        const result = await adapter.executeReadQuery(sql, queryParams);
        return { rows: result.rows, count: result.rows?.length ?? 0 };
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

export function createJsonKeysTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_keys",
    title: "MySQL JSON Keys",
    description: "Get the keys of a JSON object at the specified path.",
    group: "json",
    inputSchema: JsonKeysSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path } = JsonKeysSchema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");

      try {
        const jsonPath = path ?? "$";
        const sql = `SELECT JSON_KEYS(\`${column}\`, ?) as json_keys FROM ${escapeQualifiedTable(table)}`;

        const result = await adapter.executeReadQuery(sql, [jsonPath]);
        return { rows: result.rows };
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

export function createJsonArrayAppendTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    column: z.string(),
    path: z.string(),
    value: z.unknown(),
    where: z.string(),
  });

  return {
    name: "mysql_json_array_append",
    title: "MySQL JSON Array Append",
    description: "Append a value to a JSON array at the specified path.",
    group: "json",
    inputSchema: schema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, value, where } = schema.parse(params);

      // Validate inputs
      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateWhereClause(where);

      try {
        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_ARRAY_APPEND(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;
        const jsonValue = validateJsonString(value);

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        return { rowsAffected: result.rowsAffected };
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

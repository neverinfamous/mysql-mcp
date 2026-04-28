/**
 * MySQL JSON Tools - Helper Functions
 *
 * Simplified JSON helper tools: get, update, search, validate.
 * 4 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ZodError } from "zod";
import { formatHandlerErrorResponse } from "../core/error-helpers.js";
import {
  JsonSearchSchema,
  JsonSearchSchemaBase,
  JsonValidateSchema,
  JsonValidateSchemaBase,
  JsonGetSchema,
  JsonGetSchemaBase,
  JsonUpdateSchema,
  JsonUpdateSchemaBase,
} from "../../schemas/index.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
} from "../../../../utils/validators.js";

/**
 * Export all JSON helper tool creation functions
 */
export function createJsonGetTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_get",
    title: "MySQL JSON Get",
    description: "Simple JSON value extraction by row ID.",
    group: "json",
    inputSchema: JsonGetSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, id, idColumn } =
          JsonGetSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateIdentifier(idColumn, "column");

        const sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as value FROM ${escapeQualifiedTable(table)} WHERE \`${idColumn}\` = ?`;
        const result = await adapter.executeReadQuery(sql, [path, id]);

        // No rows = row ID doesn't exist (distinct from null JSON path)
        if (!result.rows || result.rows.length === 0) {
          return { success: true, value: null, rowFound: false };
        }

        const rawValue = result.rows?.[0]?.["value"];
        // Parse JSON value for consistency with mysql_json_extract
        // Return null for missing paths, parse objects/arrays, return primitives as-is
        if (rawValue === null || rawValue === undefined) {
          return { success: true, value: null };
        }
        // If result is already an object (MySQL driver parsed it), return as-is
        if (typeof rawValue === "object") {
          return { success: true, value: rawValue };
        }
        // Try to parse string values as JSON
        if (typeof rawValue === "string") {
          try {
            return { success: true, value: JSON.parse(rawValue) as unknown };
          } catch {
            // Return unquoted string for primitive string values
            return { success: true, value: rawValue };
          }
        }
        return { success: true, value: rawValue };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { success: false, error: "Table or column does not exist" };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonUpdateTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_update",
    title: "MySQL JSON Update",
    description: "Simple JSON value update by row ID.",
    group: "json",
    inputSchema: JsonUpdateSchemaBase,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, value, id, idColumn } =
          JsonUpdateSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateIdentifier(idColumn, "column");

        // Normalize value to valid JSON (bare strings get wrapped automatically)
        let jsonValue: string;
        if (typeof value === "string") {
          try {
            JSON.parse(value);
            jsonValue = value;
          } catch {
            // Bare string - wrap it as a JSON string
            jsonValue = JSON.stringify(value);
          }
        } else {
          jsonValue = JSON.stringify(value);
        }

        // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(\`${column}\`, ?, CAST(? AS JSON)) WHERE \`${idColumn}\` = ?`;

        const result = await adapter.executeWriteQuery(sql, [
          path,
          jsonValue,
          id,
        ]);
        if (result.rowsAffected === 0) {
          return {
            success: false,
            error: `No row found with ${idColumn} = ${String(id)}`,
          };
        }
        return { success: true };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { success: false, error: "Table or column does not exist" };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonSearchTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_search",
    title: "MySQL JSON Search",
    description:
      "Search for a string value in JSON columns and return matching paths.",
    group: "json",
    inputSchema: JsonSearchSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, searchValue, mode } =
          JsonSearchSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        const sql = `SELECT id, JSON_SEARCH(\`${column}\`, ?, ?) as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_SEARCH(\`${column}\`, ?, ?) IS NOT NULL`;

        const result = await adapter.executeReadQuery(sql, [
          mode,
          searchValue,
          mode,
          searchValue,
        ]);
        return {
          success: true,
          rows: result.rows,
          count: result.rows?.length ?? 0,
        };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return { success: false, error: "Table or column does not exist" };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

export function createJsonValidateTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_validate",
    title: "MySQL JSON Validate",
    description: "Validate if a string is valid JSON.",
    group: "json",
    inputSchema: JsonValidateSchemaBase,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { value } = JsonValidateSchema.parse(params);

        const sql = `SELECT JSON_VALID(?) as is_valid`;
        const result = await adapter.executeReadQuery(sql, [value]);

        const isValid = result.rows?.[0]?.["is_valid"] === 1;
        return { success: true, valid: isValid };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Invalid JSON text")) {
          return { success: true, valid: false };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

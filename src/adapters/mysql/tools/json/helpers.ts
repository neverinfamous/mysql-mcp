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
  validateWhereClause,
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
        const { table, column, path, where } =
          JsonGetSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        const sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as value FROM ${escapeQualifiedTable(table)} WHERE ${where}`;
        const result = await adapter.executeReadQuery(sql, [path]);

        let response;
        if (!result.rows || result.rows.length === 0) {
          response = { success: true as const, data: { value: null, rowFound: false } };
        } else {
          const rawValue = result.rows?.[0]?.["value"];
          if (rawValue === null || rawValue === undefined) {
            response = { success: true as const, data: { value: null } };
          } else if (typeof rawValue === "object") {
            response = { success: true as const, data: { value: rawValue } };
          } else if (typeof rawValue === "string") {
            try {
              response = { success: true as const, data: { value: JSON.parse(rawValue) as unknown } };
            } catch {
              response = { success: true as const, data: { value: rawValue } };
            }
          } else {
            response = { success: true as const, data: { value: rawValue } };
          }
        }
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(new Error("Table or column does not exist"));
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
        const { table, column, path, value, where } =
          JsonUpdateSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

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
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(\`${column}\`, ?, CAST(? AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql, [
          path,
          jsonValue,
        ]);
        if (result.rowsAffected === 0) {
          const response = {
            success: false as const,
            error: `No row found matching WHERE ${where}`,
          };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
        const response = { success: true as const, data: { rowsAffected: result.rowsAffected } };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(new Error("Table or column does not exist"));
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
        const response = {
          success: true as const,
          data: {
            rows: result.rows,
            count: result.rows?.length ?? 0,
          }
        };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("doesn't exist")) {
          return formatHandlerErrorResponse(new Error("Table or column does not exist"));
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
        const response = { success: true as const, data: { valid: isValid } };
        const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
        return { ...response, metrics: { tokenEstimate } };
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Invalid JSON text")) {
          const response = { success: true as const, data: { valid: false } };
          const tokenEstimate = Math.ceil(Buffer.byteLength(JSON.stringify(response), "utf8") / 4);
          return { ...response, metrics: { tokenEstimate } };
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

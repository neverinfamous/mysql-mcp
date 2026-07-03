/**
 * MySQL JSON Tools - Helper Functions
 *
 * Simplified JSON helper tools: get, update, search, validate.
 * 4 tools total.
 */

import type { MySQLAdapter } from "../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { ZodError } from "zod";
import { formatHandlerErrorResponse, withTokenEstimate } from "../core/error-helpers.js";
import {
  JsonSearchSchema,
  JsonSearchSchemaBase,
  JsonSearchOutputSchema,
  JsonValidateSchema,
  JsonValidateSchemaBase,
  JsonValidateOutputSchema,
  JsonGetSchema,
  JsonGetSchemaBase,
  JsonGetOutputSchema,
  JsonUpdateSchema,
  JsonUpdateSchemaBase,
  JsonUpdateOutputSchema,
} from "../../schemas/index.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
  validateWhereClause,
} from "../../../../utils/validators.js";
import { READ_ONLY, WRITE } from "../../../../utils/annotations.js";

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
    outputSchema: JsonGetOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, path, where } = JsonGetSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        validateWhereClause(where);

        const sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as value FROM ${escapeQualifiedTable(table)} WHERE ${where} LIMIT 1`;
        const result = await adapter.executeReadQuery(sql, [path]);

        let response;
        if (!result.rows || result.rows.length === 0) {
          response = {
            success: true as const,
            data: { value: null, rowFound: false },
          };
        } else {
          const rawValue = result.rows?.[0]?.["value"];
          if (rawValue === null || rawValue === undefined) {
            response = { success: true as const, data: { value: null } };
          } else if (typeof rawValue === "object") {
            response = { success: true as const, data: { value: rawValue } };
          } else if (typeof rawValue === "string") {
            try {
              const parsed: unknown = JSON.parse(rawValue);
              response = {
                success: true as const,
                data: { value: parsed },
              };
            } catch {
              response = { success: true as const, data: { value: rawValue } };
            }
          } else {
            response = { success: true as const, data: { value: rawValue } };
          }
        }
        return withTokenEstimate(response);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
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
    outputSchema: JsonUpdateOutputSchema,
    requiredScopes: ["write"],
    annotations: WRITE,
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

        // Use CAST(CONVERT(? USING utf8mb4) AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(\`${column}\`, ?, CAST(CONVERT(? USING utf8mb4) AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        if (result.rowsAffected === 0) {
          const response = {
            success: false as const,
            error: `No row found matching WHERE ${where}`,
            code: "NOT_FOUND",
            category: "resource" as const,
            recoverable: false,
            suggestion: undefined,
            details: undefined
          };
          return withTokenEstimate(response);
        }
        const response = {
          success: true as const,
          data: { rowsAffected: result.rowsAffected },
        };
        return withTokenEstimate(response);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
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
    outputSchema: JsonSearchOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, searchValue, mode, limit, path, escapeChar, where } =
          JsonSearchSchema.parse(params);

        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        if (where) {
          validateWhereClause(where);
        }

        const limitClause = ` LIMIT ${limit ?? 50}`;
        const userWhere = where ? ` AND (${where})` : "";
        
        let sql = "";
        const sqlParams = [];
        
        if (path) {
          sql = `SELECT *, JSON_SEARCH(\`${column}\`, ?, ?, ?, ?) as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_SEARCH(\`${column}\`, ?, ?, ?, ?) IS NOT NULL${userWhere}${limitClause}`;
          sqlParams.push(mode, searchValue, escapeChar ?? null, path, mode, searchValue, escapeChar ?? null, path);
        } else if (escapeChar) {
          sql = `SELECT *, JSON_SEARCH(\`${column}\`, ?, ?, ?) as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_SEARCH(\`${column}\`, ?, ?, ?) IS NOT NULL${userWhere}${limitClause}`;
          sqlParams.push(mode, searchValue, escapeChar, mode, searchValue, escapeChar);
        } else {
          sql = `SELECT *, JSON_SEARCH(\`${column}\`, ?, ?) as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_SEARCH(\`${column}\`, ?, ?) IS NOT NULL${userWhere}${limitClause}`;
          sqlParams.push(mode, searchValue, mode, searchValue);
        }

        const result = await adapter.executeReadQuery(sql, sqlParams);
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
    outputSchema: JsonValidateOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { value } = JsonValidateSchema.parse(params);

        const sql = `SELECT JSON_VALID(?) as is_valid`;
        const result = await adapter.executeReadQuery(sql, [value]);

        const isValid = result.rows?.[0]?.["is_valid"] === 1;
        return withTokenEstimate({ success: true, data: { valid: isValid } });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error);
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Invalid JSON text")) {
          return withTokenEstimate({ success: true, data: { valid: false } });
        }
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

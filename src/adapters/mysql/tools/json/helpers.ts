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

        const checkSql = `SELECT JSON_VALID(\`${column}\`) as is_valid FROM ${escapeQualifiedTable(table)} WHERE ${where} LIMIT 1`;
        const checkResult = await adapter.executeReadQuery(checkSql);

        let response;
        if (!checkResult.rows || checkResult.rows.length === 0) {
          response = {
            success: true as const,
            data: { value: null, rowFound: false },
          };
        } else {
          const isValid = checkResult.rows[0]?.["is_valid"];
          // Handle cases where driver returns 0, false, "0", etc.
          if (isValid === 0 || isValid === "0" || isValid === false) {
            const err = new Error(`Invalid JSON text in column \`${column}\`.`);
            err.name = "ValidationError";
            throw err;
          }
          const sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as value FROM ${escapeQualifiedTable(table)} WHERE ${where} LIMIT 1`;
          const result = await adapter.executeReadQuery(sql, [path]);
          const rawValue = result.rows?.[0]?.["value"];
          if (rawValue === null || rawValue === undefined) {
            response = { success: true as const, data: { value: null } };
          } else if (typeof rawValue === "object") {
            response = { success: true as const, data: { value: rawValue } };
          } else if (typeof rawValue === "string") {
            try {
              const parsed: unknown = JSON.parse(rawValue);
              if (parsed !== null && typeof parsed === "object") {
                response = {
                  success: true as const,
                  data: { value: parsed },
                };
              } else {
                response = { success: true as const, data: { value: rawValue } };
              }
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
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_get" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_get" });
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

        let jsonValue: string;
        if (typeof value === "string") {
          try {
            const parsed: unknown = JSON.parse(value);
            // Only treat as pre-stringified JSON if it parses to an object or array.
            // This prevents strings like "123" or "true" from being incorrectly coerced to number/boolean.
            if (parsed !== null && typeof parsed === "object") {
              jsonValue = value;
            } else {
              jsonValue = JSON.stringify(value);
            }
          } catch {
            // Bare string - wrap it as a JSON string
            jsonValue = JSON.stringify(value);
          }
        } else {
          jsonValue = JSON.stringify(value);
        }

        // Pre-flight check: ensure the column contains valid JSON or is null
        const checkSql = `SELECT JSON_VALID(\`${column}\`) as is_valid FROM ${escapeQualifiedTable(table)} WHERE ${where} LIMIT 1`;
        const checkResult = await adapter.executeReadQuery(checkSql);
        if (checkResult.rows && checkResult.rows.length > 0) {
          const isValid = checkResult.rows[0]?.["is_valid"];
          // 0, false, "0" mean invalid JSON. null means the column is null (which is valid to update if it can hold JSON, but if it's an INT it would fail. Actually, JSON_SET on a NULL JSON column might not work, but we only protect against the crash which happens on non-JSON scalar types like INT).
          if (isValid === 0 || isValid === "0" || isValid === false) {
            const err = new Error(`Invalid JSON text in column \`${column}\`.`);
            err.name = "ValidationError";
            throw err;
          }
        }

        // Use CAST(CONVERT(? USING utf8mb4) AS JSON) to ensure the value is interpreted as JSON, not as a raw string
        const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(COALESCE(\`${column}\`, '{}'), ?, CAST(CONVERT(? USING utf8mb4) AS JSON)) WHERE ${where}`;

        const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
        if (result.rowsAffected === 0) {
          // Verify if row actually exists but value was identical
          const checkSql = `SELECT 1 FROM ${escapeQualifiedTable(table)} WHERE ${where} LIMIT 1`;
          const checkResult = await adapter.executeReadQuery(checkSql, []);
          
          if (!checkResult.rows || checkResult.rows.length === 0) {
            throw new Error(`No row found matching WHERE ${where}`);
          }
        }
        const response = {
          success: true as const,
          data: { rowsAffected: result.rowsAffected },
        };
        return withTokenEstimate(response);
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_update" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_update" });
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
        const { table, column, searchValue, mode, limit, path, escapeChar, where, select } =
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
        
        const hasEscape = escapeChar !== undefined && escapeChar !== null;
        // MySQL requires escape_char in JSON_SEARCH to be a literal, not a parameter
        const escapeSql = hasEscape ? (escapeChar === '' ? "''" : `'${escapeChar.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`) : 'NULL';
        
        // Use select columns or default to *
        const selectCols = select ? select.split(",").map(c => {
          const trimmed = c.trim();
          if (trimmed === "*") return "*";
          return trimmed.split(".").map(part => `\`${part.replace(/`/g, "``")}\``).join(".");
        }).join(", ") : "*";

        if (path) {
          sql = `SELECT ${selectCols}, CASE WHEN JSON_VALID(\`${column}\`) THEN JSON_SEARCH(\`${column}\`, ?, ?, ${escapeSql}, ?) ELSE NULL END as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_VALID(\`${column}\`) = 1 AND JSON_SEARCH(\`${column}\`, ?, ?, ${escapeSql}, ?) IS NOT NULL${userWhere}${limitClause}`;
          
          const paramsList = [mode, searchValue, path];
          sqlParams.push(...paramsList, ...paramsList);
        } else if (hasEscape) {
          sql = `SELECT ${selectCols}, CASE WHEN JSON_VALID(\`${column}\`) THEN JSON_SEARCH(\`${column}\`, ?, ?, ${escapeSql}) ELSE NULL END as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_VALID(\`${column}\`) = 1 AND JSON_SEARCH(\`${column}\`, ?, ?, ${escapeSql}) IS NOT NULL${userWhere}${limitClause}`;
          sqlParams.push(mode, searchValue, mode, searchValue);
        } else {
          sql = `SELECT ${selectCols}, CASE WHEN JSON_VALID(\`${column}\`) THEN JSON_SEARCH(\`${column}\`, ?, ?) ELSE NULL END as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_VALID(\`${column}\`) = 1 AND JSON_SEARCH(\`${column}\`, ?, ?) IS NOT NULL${userWhere}${limitClause}`;
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
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_search" });
        }

        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_search" });
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

        let stringValue: string;
        if (typeof value !== "string") {
          try {
            stringValue = JSON.stringify(value);
          } catch {
            return withTokenEstimate({ success: true, data: { valid: false } });
          }
        } else {
          stringValue = value;
        }

        try {
          JSON.parse(stringValue);
        } catch {
          return withTokenEstimate({ success: true, data: { valid: false } });
        }

        const sql = `SELECT JSON_VALID(?) as is_valid`;
        const result = await adapter.executeReadQuery(sql, [stringValue]);

        const isValid = result.rows?.[0]?.["is_valid"] === 1;
        return withTokenEstimate({ success: true, data: { valid: isValid } });
      } catch (error: unknown) {
        if (error instanceof ZodError) {
          return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_validate" });
        }
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Invalid JSON text")) {
          return withTokenEstimate({ success: true, data: { valid: false } });
        }
        return formatHandlerErrorResponse(error, { module: "json", tool: "mysql_json_validate" });
      }
    },
  };
}

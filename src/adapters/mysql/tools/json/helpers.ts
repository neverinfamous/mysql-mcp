/**
 * MySQL JSON Tools - Helper Functions
 *
 * Simplified JSON helper tools: get, update, search, validate.
 * 4 tools total.
 */

import type { MySQLAdapter } from "../../MySQLAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import {
  JsonSearchSchema,
  JsonSearchSchemaBase,
  JsonValidateSchema,
} from "../../types.js";
import { z } from "zod";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
} from "../../../../utils/validators.js";

/**
 * Export all JSON helper tool creation functions
 */
export function createJsonGetTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    column: z.string(),
    path: z.string(),
    id: z.union([z.string(), z.number()]),
    idColumn: z.string().default("id"),
  });

  return {
    name: "mysql_json_get",
    title: "MySQL JSON Get",
    description: "Simple JSON value extraction by row ID.",
    group: "json",
    inputSchema: schema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, id, idColumn } = schema.parse(params);

      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateIdentifier(idColumn, "column");

      try {
        const sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as value FROM ${escapeQualifiedTable(table)} WHERE \`${idColumn}\` = ?`;
        const result = await adapter.executeReadQuery(sql, [path, id]);

        const rawValue = result.rows?.[0]?.["value"];
        // Parse JSON value for consistency with mysql_json_extract
        // Return null for missing paths, parse objects/arrays, return primitives as-is
        if (rawValue === null || rawValue === undefined) {
          return { value: null };
        }
        // If result is already an object (MySQL driver parsed it), return as-is
        if (typeof rawValue === "object") {
          return { value: rawValue };
        }
        // Try to parse string values as JSON
        if (typeof rawValue === "string") {
          try {
            return { value: JSON.parse(rawValue) as unknown };
          } catch {
            // Return unquoted string for primitive string values
            return { value: rawValue };
          }
        }
        return { value: rawValue };
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

export function createJsonUpdateTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({
    table: z.string(),
    column: z.string(),
    path: z.string(),
    value: z.unknown(),
    id: z.union([z.string(), z.number()]),
    idColumn: z.string().default("id"),
  });

  return {
    name: "mysql_json_update",
    title: "MySQL JSON Update",
    description: "Simple JSON value update by row ID.",
    group: "json",
    inputSchema: schema,
    requiredScopes: ["write"],
    annotations: {
      readOnlyHint: false,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, value, id, idColumn } = schema.parse(params);

      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");
      validateIdentifier(idColumn, "column");

      try {
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
            reason: `No row found with ${idColumn} = ${id}`,
          };
        }
        return { success: true };
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
      const { table, column, searchValue, mode } =
        JsonSearchSchema.parse(params);

      validateQualifiedIdentifier(table, "table");
      validateIdentifier(column, "column");

      try {
        const sql = `SELECT id, \`${column}\`, JSON_SEARCH(\`${column}\`, ?, ?) as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_SEARCH(\`${column}\`, ?, ?) IS NOT NULL`;

        const result = await adapter.executeReadQuery(sql, [
          mode,
          searchValue,
          mode,
          searchValue,
        ]);
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

export function createJsonValidateTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_validate",
    title: "MySQL JSON Validate",
    description: "Validate if a string is valid JSON.",
    group: "json",
    inputSchema: JsonValidateSchema,
    requiredScopes: ["read"],
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    handler: async (params: unknown, _context: RequestContext) => {
      const { value } = JsonValidateSchema.parse(params);

      // Auto-convert bare strings to JSON strings (matching other JSON tools)
      let jsonValue = value;
      if (typeof value === "string") {
        try {
          JSON.parse(value);
        } catch {
          jsonValue = JSON.stringify(value);
        }
      }

      try {
        const sql = `SELECT JSON_VALID(?) as is_valid`;
        const result = await adapter.executeReadQuery(sql, [jsonValue]);

        const isValid = result.rows?.[0]?.["is_valid"] === 1;
        return {
          valid: isValid,
          ...(jsonValue !== value && { autoConverted: true }),
        };
      } catch (error) {
        // MySQL may throw an error for severely malformed input
        // Return a structured error response instead of propagating
        const message =
          error instanceof Error ? error.message : "Unknown validation error";
        return { valid: false, error: message };
      }
    },
  };
}

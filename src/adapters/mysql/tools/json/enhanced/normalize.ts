import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  JsonNormalizeSchema,
  JsonNormalizeSchemaBase,
  JsonNormalizeOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../../core/error-helpers.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
  validateWhereClause,
} from "../../../../../utils/validators.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createJsonNormalizeTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_json_normalize",
    title: "MySQL JSON Normalize",
    description:
      "Normalize JSON column structure by extracting all unique keys across documents.",
    group: "json",
    inputSchema: JsonNormalizeSchemaBase,
    outputSchema: JsonNormalizeOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, where, limit } =
          JsonNormalizeSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");
        if (where) {
          validateWhereClause(where);
        }

        const whereClause = where ? `WHERE ${where}` : "";

        const sampleSubquery = `(SELECT \`${column}\` FROM ${escapeQualifiedTable(table)} ${whereClause} LIMIT ${String(limit)})`;

        // Get all unique top-level keys from the sample
        const keysQuery = `
                SELECT DISTINCT jt.key_name
                FROM ${sampleSubquery} as sample,
                JSON_TABLE(
                    JSON_KEYS(CASE WHEN JSON_VALID(sample.\`${column}\`) THEN sample.\`${column}\` ELSE '{}' END),
                    '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')
                ) as jt
            `;

        const keysResult = await adapter.executeQuery(keysQuery);
        const uniqueKeys = (keysResult.rows ?? []).map((r) => String(r["key_name"]));

        // Get type distribution for each key
        const keyStats: Record<string, unknown>[] = [];
        for (const key of uniqueKeys.slice(0, 20)) {
          // Limit to 20 keys
          const jsonPath = '$."' + key.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
          const typeQuery = `
                    SELECT 
                        JSON_TYPE(JSON_EXTRACT(CASE WHEN JSON_VALID(sample.\`${column}\`) THEN sample.\`${column}\` ELSE '{}' END, ?)) as value_type,
                        COUNT(*) as count
                    FROM ${sampleSubquery} as sample
                    GROUP BY value_type
                `;
          const typeResult = await adapter.executeQuery(typeQuery, [jsonPath]);
          keyStats.push({
            key,
            types: typeResult.rows ?? [],
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            uniqueKeys: uniqueKeys.slice(0, 100),
            keyCount: uniqueKeys.length,
            keyStats,
            truncated: uniqueKeys.length > 20,
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

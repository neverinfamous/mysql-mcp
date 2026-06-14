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

        const whereClause = where ? `WHERE ${where}` : "";

        // Get all unique top-level keys
        const keysQuery = `
                SELECT DISTINCT jt.key_name
                FROM ${escapeQualifiedTable(table)},
                JSON_TABLE(
                    JSON_KEYS(\`${column}\`),
                    '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')
                ) as jt
                ${whereClause}
                LIMIT ${String(limit)}
            `;

        const keysResult = await adapter.executeQuery(keysQuery);
        const uniqueKeys = (keysResult.rows ?? []).map((r) => r["key_name"]);

        // Get type distribution for each key
        const keyStats: Record<string, unknown>[] = [];
        for (const key of uniqueKeys.slice(0, 20)) {
          // Limit to 20 keys
          const typeQuery = `
                    SELECT 
                        JSON_TYPE(JSON_EXTRACT(\`${column}\`, CONCAT('$.', ?))) as value_type,
                        COUNT(*) as count
                    FROM ${escapeQualifiedTable(table)}
                    ${whereClause}
                    GROUP BY value_type
                `;
          const typeResult = await adapter.executeQuery(typeQuery, [key]);
          keyStats.push({
            key,
            types: typeResult.rows ?? [],
          });
        }

        return withTokenEstimate({
          success: true,
          data: {
            uniqueKeys,
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

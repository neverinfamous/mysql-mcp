import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  JsonIndexSuggestSchema,
  JsonIndexSuggestSchemaBase,
  JsonIndexSuggestOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse, withTokenEstimate } from "../../core/error-helpers.js";
import {
  validateQualifiedIdentifier,
  escapeQualifiedTable,
  validateIdentifier,
} from "../../../../../utils/validators.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createJsonIndexSuggestTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_json_index_suggest",
    title: "MySQL JSON Index Suggest",
    description:
      "Suggest functional indexes for frequently accessed JSON paths.",
    group: "json",
    inputSchema: JsonIndexSuggestSchemaBase,
    outputSchema: JsonIndexSuggestOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, sampleSize } =
          JsonIndexSuggestSchema.parse(params);

        // Validate identifiers
        validateQualifiedIdentifier(table, "table");
        validateIdentifier(column, "column");

        // Get top-level keys and their types
        const keysQuery = `
                SELECT DISTINCT jt.key_name
                FROM ${escapeQualifiedTable(table)},
                JSON_TABLE(
                    JSON_KEYS(\`${column}\`),
                    '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')
                ) as jt
                LIMIT ${String(sampleSize)}
            `;

        const keysResult = await adapter.executeQuery(keysQuery);
        const keys = (keysResult.rows ?? []).map(
          (r) => typeof r["key_name"] === "string" ? r["key_name"] : "",
        );

        // Check cardinality and suggest indexes
        const suggestions: {
          path: string;
          type: string;
          cardinality: number;
          indexDdl: string;
        }[] = [];

        for (const key of keys.slice(0, 10)) {
          // Analyze top 10 keys
          // Use standard SQL structure for strict FULL_GROUP_BY compliance
          const cardQuery = `
                    SELECT 
                        t.value_type,
                        COUNT(DISTINCT t.val) as cardinality
                    FROM (
                        SELECT 
                            JSON_TYPE(JSON_EXTRACT(\`sub\`.\`${column}\`, CONCAT('$.', ?))) as value_type,
                            JSON_EXTRACT(\`sub\`.\`${column}\`, CONCAT('$.', ?)) as val
                        FROM (
                            SELECT \`${column}\` 
                            FROM ${escapeQualifiedTable(table)} 
                            LIMIT ${String(sampleSize)}
                        ) as sub
                        WHERE JSON_EXTRACT(\`sub\`.\`${column}\`, CONCAT('$.', ?)) IS NOT NULL
                    ) as t
                    GROUP BY t.value_type
                    ORDER BY cardinality DESC
                    LIMIT 1
                `;
          const cardResult = await adapter.executeQuery(cardQuery, [
            key,
            key,
            key,
          ]);
          const cardRow = cardResult.rows?.[0];

          const valueType = typeof cardRow?.["value_type"] === "string" ? cardRow["value_type"] : undefined;
          const cardinality = Number(cardRow?.["cardinality"] ?? 0);

          if (cardinality > 1) {
            let dataType = "VARCHAR(255)";
            if (valueType === "INTEGER") dataType = "BIGINT";
            else if (valueType === "DOUBLE") dataType = "DOUBLE";
            else if (valueType === "BOOLEAN") dataType = "TINYINT(1)";

            suggestions.push({
              path: `$.${key}`,
              type: valueType ?? "UNKNOWN",
              cardinality,
              indexDdl: `ALTER TABLE ${escapeQualifiedTable(table)} ADD INDEX idx_${table.split(".").pop()}_${key} ((CAST(JSON_EXTRACT(\`${column}\`, '$.${key}') AS ${dataType})));`,
            });
          }
        }

        // Sort by cardinality (higher is better for indexing)
        suggestions.sort((a, b) => b.cardinality - a.cardinality);

        return withTokenEstimate({
          success: true,
          data: {
            table,
            column,
            suggestions: suggestions.slice(0, 5), // Top 5 suggestions
            suggestion:
              "Indexes on high-cardinality paths provide the most benefit. Consider query patterns when creating indexes.",
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

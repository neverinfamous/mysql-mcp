import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { ValidationError } from "../../../../../types/index.js";
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
                FROM (
                    SELECT \`${column}\`
                    FROM ${escapeQualifiedTable(table)}
                    WHERE JSON_VALID(\`${column}\`) = 1
                    LIMIT ${String(sampleSize)}
                ) as sub,
                JSON_TABLE(
                    JSON_KEYS(sub.\`${column}\`),
                    '$[*]' COLUMNS (key_name VARCHAR(255) PATH '$')
                ) as jt
            `;

        const keysResult = await adapter.executeQuery(keysQuery);
        const keys = (keysResult.rows ?? [])
          .map((r) => r["key_name"])
          .filter((k): k is string => typeof k === "string" && k.length > 0);

        if (keys.length === 0) {
          throw new ValidationError(`The target column contains no valid JSON objects to analyze.`);
        }

        // Check cardinality and suggest indexes
        const suggestions: {
          path: string;
          type: string;
          cardinality: number;
          indexDdl: string;
        }[] = [];

        for (const key of keys.slice(0, 10)) {
          // Analyze top 10 keys
          // Construct proper JSON path with quotes to handle spaces and special characters
          const jsonPath = `$."${key.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
          
          // Use standard SQL structure for strict FULL_GROUP_BY compliance
          const cardQuery = `
                    SELECT 
                        t.value_type,
                        COUNT(DISTINCT t.val) as cardinality
                    FROM (
                        SELECT 
                            JSON_TYPE(JSON_EXTRACT(\`sub\`.\`${column}\`, ?)) as value_type,
                            JSON_EXTRACT(\`sub\`.\`${column}\`, ?) as val
                        FROM (
                            SELECT \`${column}\` 
                            FROM ${escapeQualifiedTable(table)} 
                            WHERE JSON_VALID(\`${column}\`) = 1
                            LIMIT ${String(sampleSize)}
                        ) as sub
                        WHERE JSON_EXTRACT(\`sub\`.\`${column}\`, ?) IS NOT NULL
                    ) as t
                    GROUP BY t.value_type
                    ORDER BY cardinality DESC
                    LIMIT 1
                `;
          const cardResult = await adapter.executeQuery(cardQuery, [
            jsonPath,
            jsonPath,
            jsonPath,
          ]);
          const cardRow = cardResult.rows?.[0];

          const valueType = typeof cardRow?.["value_type"] === "string" ? cardRow["value_type"] : undefined;
          const cardinality = Number(cardRow?.["cardinality"] ?? 0);

          if (cardinality > 1) {
            let dataType = "CHAR(255)";
            if (valueType === "INTEGER") dataType = "SIGNED";
            else if (valueType === "DOUBLE") dataType = "DOUBLE";
            else if (valueType === "BOOLEAN") dataType = "SIGNED";

            const tableName = table.split(".").pop() || "tbl";
            const shortTableName = tableName.substring(0, 20);
            let cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '').substring(0, 25);
            if (!cleanKey && key.length > 0) {
              cleanKey = key.split('').map(c => c.charCodeAt(0).toString(16)).join('').substring(0, 8);
            }
            if (!cleanKey) {
              cleanKey = "empty";
            }
            // Append a short hash of the original key to prevent duplicate index names
            // for keys that strip down to the same alphanumeric string (e.g. "foo bar" and "foo.bar").
            const shortHash = Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
            cleanKey = `${cleanKey}_${shortHash}`;

            suggestions.push({
              path: jsonPath,
              type: valueType ?? "UNKNOWN",
              cardinality,
              indexDdl: `ALTER TABLE ${escapeQualifiedTable(table)} ADD INDEX idx_${shortTableName}_${cleanKey} ((CAST(JSON_UNQUOTE(JSON_EXTRACT(\`${column}\`, '${jsonPath.replace(/\\/g, "\\\\").replace(/'/g, "''")}')) AS ${dataType})));`,
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

        if (error instanceof Error) {
          const msg = error.message;
          if (msg.includes("Invalid data type for JSON data") || msg.includes("Invalid JSON text")) {
            return formatHandlerErrorResponse(new ValidationError(`The target column contains invalid JSON or is not a JSON type.`));
          }
        }

        return formatHandlerErrorResponse(error);
      }
    },
  };
}

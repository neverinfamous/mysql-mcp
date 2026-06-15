import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { PercentilesOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { PercentilesSchemaBase, PercentilesSchema } from "./schemas.js";

/**
 * Calculate percentiles
 */
export function createPercentilesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_percentiles",
    title: "MySQL Percentiles",
    description: "Calculate percentile values for a numeric column.",
    group: "stats",
    inputSchema: PercentilesSchemaBase,
    outputSchema: PercentilesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, percentiles, where } =
          PercentilesSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid column name",
          });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Check if column is numeric
        const colCheck = await adapter.executeQuery(
          `SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column],
        );
        const dataTypeVal = colCheck.rows?.[0]?.["DATA_TYPE"];
        const dataType =
          typeof dataTypeVal === "string" ? dataTypeVal.toLowerCase() : "";
        // Empty result means column doesn't exist; non-empty result with non-numeric type means wrong type
        if (!colCheck.rows || colCheck.rows.length === 0) {
          return withTokenEstimate({
            success: false,
            error: `Column '${column}' not found on table '${table}'`,
          });
        }
        if (
          ![
            "tinyint",
            "smallint",
            "mediumint",
            "int",
            "bigint",
            "decimal",
            "numeric",
            "float",
            "double",
          ].includes(dataType)
        ) {
          return withTokenEstimate({
            success: false,
            error: `Column type mismatch: '${column}' is not a numeric column (type: ${dataType})`,
          });
        }

        // Get total count
        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) as cnt FROM \`${table}\` ${whereClause}`,
        );
        const totalCount = (countResult.rows?.[0]?.["cnt"] as number) ?? 0;

        if (totalCount === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              column,
              totalCount: 0,
              percentiles: {},
            },
          });
        }

        // Calculate each percentile
        const percentileResults: Record<string, unknown> = {};

        for (const p of percentiles) {
          const offset = Math.floor((p / 100) * (totalCount - 1));
          const query = `
                    SELECT \`${column}\` as value
                    FROM \`${table}\`
                    ${whereClause}
                    ORDER BY \`${column}\`
                    LIMIT 1 OFFSET ${String(offset)}
                `;

          const result = await adapter.executeQuery(query);
          const valueRow = result.rows?.[0];
          percentileResults[`p${String(p)}`] = valueRow?.["value"] ?? null;
        }

        return withTokenEstimate({
          success: true,
          data: {
            column,
            totalCount,
            percentiles: percentileResults,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

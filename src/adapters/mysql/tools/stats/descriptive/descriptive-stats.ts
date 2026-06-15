import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { DescriptiveStatsOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { DescriptiveStatsSchemaBase, DescriptiveStatsSchema } from "./schemas.js";

/**
 * Calculate descriptive statistics
 */
export function createDescriptiveStatsTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_descriptive",
    title: "MySQL Descriptive Statistics",
    description:
      "Calculate descriptive statistics (mean, median, stddev, min, max, count) for a numeric column.",
    group: "stats",
    inputSchema: DescriptiveStatsSchemaBase,
    outputSchema: DescriptiveStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, where } = DescriptiveStatsSchema.parse(params);
        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid column name",
          });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Get basic count for median calculation
        const countResult = await adapter.executeQuery(
          `SELECT COUNT(*) as count FROM \`${table}\` ${whereClause}`,
        );
        const totalCount = Number(countResult.rows?.[0]?.["count"] ?? 0);

        if (totalCount === 0) {
          return withTokenEstimate({
            success: true,
            data: {
              column,
              count: 0,
              mean: null,
              median: null,
              stddev: null,
              variance: null,
              min: null,
              max: null,
              range: null,
              sum: null,
            },
          });
        }

        // Calculate median offset/limit
        const limit = 2 - (totalCount % 2);
        const offset = Math.floor((totalCount - 1) / 2);

        const medianQuery = `
                SELECT AVG(val) as median
                FROM (
                    SELECT \`${column}\` as val
                    FROM \`${table}\`
                    ${whereClause}
                    ORDER BY \`${column}\`
                    LIMIT ${String(limit)}
                    OFFSET ${String(offset)}
                ) as median_calc
            `;

        const query = `
                SELECT
                    COUNT(\`${column}\`) as count,
                    AVG(\`${column}\`) as mean,
                    STD(\`${column}\`) as stddev,
                    VAR_POP(\`${column}\`) as variance,
                    MIN(\`${column}\`) as min,
                    MAX(\`${column}\`) as max,
                    MAX(\`${column}\`) - MIN(\`${column}\`) as \`range\`,
                    SUM(\`${column}\`) as sum
                FROM \`${table}\`
                ${whereClause}
            `;

        const [statsResult, medianResult] = await Promise.all([
          adapter.executeQuery(query),
          adapter.executeQuery(medianQuery),
        ]);

        const stats = statsResult.rows?.[0];
        const medianRow = medianResult.rows?.[0];

        return withTokenEstimate({
          success: true,
          data: {
            column,
            count: Number(stats?.["count"] ?? 0),
            mean: stats?.["mean"] != null ? Number(stats?.["mean"]) : null,
            median:
              medianRow?.["median"] != null
                ? Number(medianRow?.["median"])
                : null,
            stddev:
              stats?.["stddev"] != null ? Number(stats?.["stddev"]) : null,
            variance:
              stats?.["variance"] != null ? Number(stats?.["variance"]) : null,
            min: stats?.["min"] != null ? Number(stats?.["min"]) : null,
            max: stats?.["max"] != null ? Number(stats?.["max"]) : null,
            range: stats?.["range"] != null ? Number(stats?.["range"]) : null,
            sum: stats?.["sum"] != null ? Number(stats?.["sum"]) : null,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

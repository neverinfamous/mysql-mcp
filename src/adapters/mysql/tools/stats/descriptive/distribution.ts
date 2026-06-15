import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { DistributionOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { DistributionSchemaBase, DistributionSchema } from "./schemas.js";

/**
 * Analyze data distribution
 */
export function createDistributionTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_distribution",
    title: "MySQL Distribution Analysis",
    description:
      "Analyze the distribution of values in a column with histogram buckets.",
    group: "stats",
    inputSchema: DistributionSchemaBase,
    outputSchema: DistributionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { table, column, buckets, where } =
          DistributionSchema.parse(params);
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
        if (buckets < 1) {
          return withTokenEstimate({
            success: false,
            error: "buckets must be at least 1",
          });
        }

        const whereClause = where ? `WHERE ${where}` : "";

        // Get min/max for bucket calculation
        const rangeResult = await adapter.executeQuery(
          `SELECT MIN(\`${column}\`) as min_val, MAX(\`${column}\`) as max_val FROM \`${table}\` ${whereClause}`,
        );

        const rangeRow = rangeResult.rows?.[0];
        const minVal = Number(rangeRow?.["min_val"]) || 0;
        const maxVal = Number(rangeRow?.["max_val"]) || 0;

        if (minVal === maxVal) {
          return withTokenEstimate({
            success: true,
            data: {
              column,
              distribution: [
                { bucket: 0, rangeStart: minVal, rangeEnd: maxVal, count: 1 },
              ],
              bucketCount: 1,
              minValue: minVal,
              maxValue: maxVal,
            },
          });
        }

        const bucketSize = (maxVal - minVal) / buckets;

        // Generate distribution query with WIDTH_BUCKET emulation
        // Clamp with LEAST to prevent max value from creating an extra bucket
        const query = `
                SELECT
                    LEAST(FLOOR((\`${column}\` - ${String(minVal)}) / ${String(bucketSize)}), ${String(buckets - 1)}) as bucket,
                    COUNT(*) as count,
                    MIN(\`${column}\`) as bucket_min,
                    MAX(\`${column}\`) as bucket_max
                FROM \`${table}\`
                ${whereClause}
                GROUP BY bucket
                ORDER BY bucket
            `;

        const result = await adapter.executeQuery(query);

        // Format buckets with proper ranges
        const distribution = (result.rows ?? []).map((row) => {
          const r = row;
          const bucketNum = Number(r["bucket"]) || 0;
          return {
            bucket: bucketNum,
            rangeStart: minVal + bucketNum * bucketSize,
            rangeEnd: minVal + (bucketNum + 1) * bucketSize,
            count: Number(r["count"]),
            bucketMin: r["bucket_min"],
            bucketMax: r["bucket_max"],
          };
        });

        return withTokenEstimate({
          success: true,
          data: {
            column,
            distribution,
            bucketCount: buckets,
            bucketSize,
            minValue: minVal,
            maxValue: maxVal,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

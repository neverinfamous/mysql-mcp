import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { TimeSeriesOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { TimeSeriesSchemaBase, TimeSeriesSchema } from "./schemas.js";

/**
 * Time series analysis with moving averages
 */
export function createTimeSeriesToolStats(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_time_series",
    title: "MySQL Time Series Analysis",
    description:
      "Aggregate and analyze time series data with specified intervals.",
    group: "stats",
    inputSchema: TimeSeriesSchemaBase,
    outputSchema: TimeSeriesOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const {
          table,
          valueColumn,
          timeColumn,
          interval,
          aggregation,
          where,
          limit,
        } = TimeSeriesSchema.parse(params);

        // Validate identifiers
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid table name",
          });
        }
        if (
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(valueColumn) ||
          !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(timeColumn)
        ) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid column name",
          });
        }

        const validIntervals = ["minute", "hour", "day", "week", "month"];
        if (!validIntervals.includes(interval)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: `Invalid interval: '${interval}' — expected one of: ${validIntervals.join(", ")}`,
          });
        }
        const validAggregations = ["avg", "sum", "count", "min", "max"];
        if (!validAggregations.includes(aggregation)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: `Invalid aggregation: '${aggregation}' — expected one of: ${validAggregations.join(", ")}`,
          });
        }

        let dateFormat: string;
        switch (interval) {
          case "minute":
            dateFormat = "%Y-%m-%d %H:%i:00";
            break;
          case "hour":
            dateFormat = "%Y-%m-%d %H:00:00";
            break;
          case "day":
            dateFormat = "%Y-%m-%d";
            break;
          case "week":
            dateFormat = "%x-W%v";
            break;
          case "month":
            dateFormat = "%Y-%m";
            break;
          default:
            dateFormat = "%Y-%m-%d";
        }

        const whereClause = where ? `WHERE ${where}` : "";
        const aggFunc = aggregation.toUpperCase();

        const query = `
                SELECT
                    DATE_FORMAT(\`${timeColumn}\`, '${dateFormat}') as period,
                    ${aggFunc}(\`${valueColumn}\`) as value,
                    COUNT(*) as data_points,
                    MIN(\`${valueColumn}\`) as period_min,
                    MAX(\`${valueColumn}\`) as period_max
                FROM \`${table}\`
                ${whereClause}
                GROUP BY period
                ORDER BY period DESC
                LIMIT ${String(limit)}
            `;
        const result = await adapter.executeQuery(query);

        return withTokenEstimate({
          success: true,
          data: {
            interval,
            aggregation,
            valueColumn,
            timeColumn,
            dataPoints: result.rows ?? [],
            count: result.rows?.length ?? 0,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

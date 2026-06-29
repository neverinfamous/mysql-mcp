import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import { WindowFunctionOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { StatsMovingAvgSchemaBase, StatsMovingAvgSchema } from "./schemas.js";
import { selectList, partitionClause, whereClause } from "./helpers.js";

// =============================================================================
// MOVING AVERAGE
// =============================================================================

export function createStatsMovingAvgTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_moving_avg",
    title: "Stats Moving Avg",
    description:
      "Calculate moving average (AVG OVER sliding window) for a numeric column. Specify windowSize for the number of preceding rows to include.",
    group: "stats",
    inputSchema: StatsMovingAvgSchemaBase,
    outputSchema: WindowFunctionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsMovingAvgSchema.parse(params);

        if (!/^[a-zA-Z0-9_.]+$/.test(parsed.table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid table name",
          });
        }
        
        const fullTableName = parsed.database 
          ? `\`${parsed.database}\`.\`${parsed.table}\`` 
          : (parsed.table.includes('.') ? parsed.table.split('.').map(p => `\`${p}\``).join('.') : `\`${parsed.table}\``);
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.column)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: "Invalid column name",
          });
        }

        const windowSize = parsed.windowSize;
        const partition = partitionClause(parsed.partitionBy);
        const preceding = windowSize - 1;
        const windowExpr = `AVG(\`${parsed.column}\`) OVER(${partition} ORDER BY ${parsed.orderBy} ROWS BETWEEN ${String(preceding)} PRECEDING AND CURRENT ROW)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "moving_avg")}
          FROM ${fullTableName}
          ${whereClause(parsed.where)}
          ORDER BY ${parsed.orderBy}
          LIMIT ${String(parsed.limit)} OFFSET ${String(parsed.offset)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          data: {
            valueColumn: parsed.column,
            windowSize,
            rowCount: rows.length,
            rows,
          },
        });
      } catch (error) {
        return formatHandlerErrorResponse(error);
      }
    },
  };
}

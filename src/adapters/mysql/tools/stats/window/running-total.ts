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
import { StatsRunningTotalSchemaBase, StatsRunningTotalSchema } from "./schemas.js";
import { selectList, partitionClause, whereClause } from "./helpers.js";

// =============================================================================
// RUNNING TOTAL
// =============================================================================

export function createStatsRunningTotalTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_stats_running_total",
    title: "Stats Running Total",
    description:
      "Calculate cumulative running total (SUM OVER) for a numeric column. Use partitionBy to reset total per group.",
    group: "stats",
    inputSchema: StatsRunningTotalSchemaBase,
    outputSchema: WindowFunctionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsRunningTotalSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.column)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid column name",
          });
        }

        const partition = partitionClause(parsed.partitionBy);
        const windowExpr = `SUM(\`${parsed.column}\`) OVER(${partition} ORDER BY ${parsed.orderBy} ROWS UNBOUNDED PRECEDING)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "running_total")}
          FROM \`${parsed.table}\`
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

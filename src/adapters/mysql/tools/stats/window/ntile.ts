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
import { StatsNtileSchemaBase, StatsNtileSchema } from "./schemas.js";
import { selectList, partitionClause, whereClause } from "./helpers.js";

// =============================================================================
// NTILE
// =============================================================================

export function createStatsNtileTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_ntile",
    title: "Stats Ntile",
    description:
      "Divide ordered rows into N equal buckets (e.g., quartiles with buckets=4). Returns bucket assignment per row.",
    group: "stats",
    inputSchema: StatsNtileSchemaBase,
    outputSchema: WindowFunctionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsNtileSchema.parse(params);

        if (!/^[a-zA-Z0-9_.]+$/.test(parsed.table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid table name",
          });
        }
        
        const fullTableName = parsed.database 
          ? `\`${parsed.database}\`.\`${parsed.table}\`` 
          : (parsed.table.includes('.') ? parsed.table.split('.').map(p => `\`${p}\``).join('.') : `\`${parsed.table}\``);

        const buckets = parsed.buckets;
        const partition = partitionClause(parsed.partitionBy);
        const windowExpr = `NTILE(${String(buckets)}) OVER(${partition} ORDER BY ${parsed.orderBy})`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, "ntile")}
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
            buckets,
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

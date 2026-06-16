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
import { StatsRankSchemaBase, StatsRankSchema } from "./schemas.js";
import { selectList, partitionClause, whereClause } from "./helpers.js";

// =============================================================================
// RANK / DENSE_RANK / PERCENT_RANK
// =============================================================================

export function createStatsRankTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_rank",
    title: "Stats Rank",
    description:
      "Assign rank within an ordered result set. Supports rank (gaps), dense_rank (no gaps), and percent_rank (0-1). Use partitionBy to rank within groups.",
    group: "stats",
    inputSchema: StatsRankSchemaBase,
    outputSchema: WindowFunctionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsRankSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR",
            error: "Invalid table name",
          });
        }

        const rankType = parsed.method;
        const partition = partitionClause(parsed.partitionBy);
        const fnName = rankType.toUpperCase();

        const windowExpr = `${fnName}() OVER(${partition} ORDER BY ${parsed.orderBy})`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, rankType)}
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
            rankType,
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

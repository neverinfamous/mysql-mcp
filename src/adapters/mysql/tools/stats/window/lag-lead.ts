import { ZodError } from "zod";
import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  formatHandlerErrorResponse,
  formatMysqlError,
  withTokenEstimate,
} from "../../core/error-helpers.js";
import { WindowFunctionOutputSchema } from "../../../schemas/stats.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { StatsLagLeadSchemaBase, StatsLagLeadSchema } from "./schemas.js";
import { selectList, partitionClause, whereClause } from "./helpers.js";

// =============================================================================
// LAG / LEAD
// =============================================================================

export function createStatsLagLeadTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_stats_lag_lead",
    description:
      "Access data from previous (LAG) or next (LEAD) rows in an ordered set. Useful for comparisons, deltas, and change detection.",
    group: "stats",
    inputSchema: StatsLagLeadSchemaBase,
    outputSchema: WindowFunctionOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const parsed = StatsLagLeadSchema.parse(params);

        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.table)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid table name",
          });
        }
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(parsed.column)) {
          return withTokenEstimate({
            success: false,
            error: "Invalid column name",
          });
        }

        const partition = partitionClause(parsed.partitionBy);
        const fnName = parsed.direction.toUpperCase();
        const defaultArg =
          parsed.defaultValue !== undefined
            ? `, '${parsed.defaultValue.replace(/'/g, "''")}'`
            : "";

        const windowExpr = `${fnName}(\`${parsed.column}\`, ${String(parsed.offset)}${defaultArg}) OVER(${partition} ORDER BY \`${parsed.orderBy}\`)`;
        const alias = `${parsed.direction}_value`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, alias)}
          FROM \`${parsed.table}\`
          ${whereClause(parsed.where)}
          ORDER BY \`${parsed.orderBy}\`
          LIMIT ${String(parsed.limit)} OFFSET ${String(parsed.paginationOffset)}
        `;

        const result = await adapter.executeQuery(sql);
        const rows = result.rows ?? [];

        return withTokenEstimate({
          success: true,
          data: {
            direction: parsed.direction,
            offset: parsed.offset,
            rowCount: rows.length,
            rows,
          },
        });
      } catch (error: unknown) {
        if (error instanceof ZodError) return formatHandlerErrorResponse(error);
        const msg = formatMysqlError(error);
        if (msg.includes("doesn't exist")) {
          return withTokenEstimate({
            success: false,
            error: `Table '${((params as Record<string, unknown>)?.["table"] as string) ?? "unknown"}' doesn't exist`,
          });
        }
        if (msg.includes("Unknown column")) {
          return withTokenEstimate({
            success: false,
            error: "One or more referenced columns do not exist on the table",
          });
        }
        return withTokenEstimate({ success: false, error: msg });
      }
    },
  };
}

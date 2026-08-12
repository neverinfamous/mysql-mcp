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
import { validateWhereClause } from "../../../../../utils/validators.js";
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

        const { parseQualifiedTable, validateQualifiedIdentifier, escapeQualifiedTable } = await import("../../../../../utils/validators.js");
        const cleanTable = parseQualifiedTable(parsed.table);
        const tableNameToValidate = cleanTable.schema ? `${cleanTable.schema}.${cleanTable.table}` : cleanTable.table;
        try {
          validateQualifiedIdentifier(tableNameToValidate);
        } catch (e: unknown) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: e instanceof Error ? e.message : "Invalid table name",
          });
        }
        
        const fullTableName = parsed.database 
          ? `\`${parsed.database}\`.${escapeQualifiedTable(parsed.table)}` 
          : escapeQualifiedTable(parsed.table);

        const cleanColumn = parseQualifiedTable(parsed.column);
        const columnToValidate = cleanColumn.schema ? `${cleanColumn.schema}.${cleanColumn.table}` : cleanColumn.table;
        try {
          validateQualifiedIdentifier(columnToValidate, "column");
        } catch (e: unknown) {
          return withTokenEstimate({
            success: false,
            code: "VALIDATION_ERROR", category: "validation", recoverable: false, error: e instanceof Error ? e.message : "Invalid column name",
          });
        }

        validateWhereClause(parsed.where);
        validateWhereClause(parsed.orderBy);
        validateWhereClause(parsed.partitionBy);

        const windowSize = parsed.windowSize;
        const partition = partitionClause(parsed.partitionBy);
        const preceding = windowSize - 1;
        const escapedColumn = escapeQualifiedTable(parsed.column);
        const windowExpr = `AVG(${escapedColumn}) OVER(${partition} ORDER BY ${parsed.orderBy} ROWS BETWEEN ${String(preceding)} PRECEDING AND CURRENT ROW)`;

        const sql = `
          SELECT ${selectList(parsed.selectColumns, windowExpr, parsed.asColumn)}
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

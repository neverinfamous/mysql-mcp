import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  QueryStatsSchema,
  QueryStatsSchemaBase,
  QueryStatsOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { sanitizeTimerRows } from "./helpers.js";

export function createQueryStatsTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_query_stats",
    title: "MySQL Query Stats",
    description: "Get top query statistics from performance_schema. NOTE: This returns overall server query stats. Do NOT pass a specific query or sql string.",
    group: "performance",
    inputSchema: QueryStatsSchemaBase,
    outputSchema: QueryStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { orderBy, limit } = QueryStatsSchema.parse(params);
        const orderColumn = {
          total_time: "SUM_TIMER_WAIT",
          avg_time: "AVG_TIMER_WAIT",
          executions: "COUNT_STAR",
        }[orderBy];

        const sql = `
                SELECT 
                    SCHEMA_NAME as database_name,
                    LEFT(DIGEST_TEXT, 200) as query_text,
                    COUNT_STAR as execution_count,
                    AVG_TIMER_WAIT/1000000000 as avg_time_ms,
                    MAX_TIMER_WAIT/1000000000 as max_time_ms,
                    SUM_TIMER_WAIT/1000000000 as total_time_ms,
                    SUM_ROWS_EXAMINED as total_rows_examined,
                    SUM_ROWS_SENT as total_rows_sent,
                    FIRST_SEEN as first_seen,
                    LAST_SEEN as last_seen
                FROM performance_schema.events_statements_summary_by_digest
                WHERE DIGEST_TEXT IS NOT NULL
                ORDER BY ${orderColumn} DESC
                LIMIT ${Math.min(limit, 20)}
            `;

        const result = await adapter.executeReadQuery(sql);
        const response = {
          success: true,
          data: {
            queries: sanitizeTimerRows(result.rows, [
              "avg_time_ms",
              "max_time_ms",
              "total_time_ms",
            ]),
          },
        };
        const tokenEstimate = Math.ceil(
          Buffer.byteLength(JSON.stringify(response), "utf8") / 4,
        );
        return { ...response, metrics: { tokenEstimate } };
      } catch (err) {
        return formatHandlerErrorResponse(err);
      }
    },
  };
}

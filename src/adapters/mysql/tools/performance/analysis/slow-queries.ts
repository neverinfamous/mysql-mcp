import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  SlowQuerySchema,
  SlowQuerySchemaBase,
  SlowQueryOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { sanitizeTimerRows } from "./helpers.js";

export function createSlowQueriesTool(adapter: MySQLAdapter): ToolDefinition {
  return {
    name: "mysql_slow_queries",
    title: "MySQL Slow Queries",
    description: "Get slow queries from performance_schema (if available).",
    group: "performance",
    inputSchema: SlowQuerySchemaBase,
    outputSchema: SlowQueryOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit, minTime } = SlowQuerySchema.parse(params);
        let sql = `
                SELECT 
                    LEFT(DIGEST_TEXT, 200) as query,
                    COUNT_STAR as executions,
                    AVG_TIMER_WAIT/1000000000 as avg_time_ms,
                    SUM_TIMER_WAIT/1000000000 as total_time_ms,
                    SUM_ROWS_EXAMINED as rows_examined,
                    SUM_ROWS_SENT as rows_sent
                FROM performance_schema.events_statements_summary_by_digest
            `;

        if (minTime !== undefined) {
          sql += ` WHERE AVG_TIMER_WAIT > ${minTime * 1000000000000}`;
        }

        const actualLimit = Math.min(limit, 100);

        sql += ` ORDER BY AVG_TIMER_WAIT DESC LIMIT ${actualLimit}`;

        const result = await adapter.executeReadQuery(sql);
        const response = {
          success: true,
          data: {
            slowQueries: sanitizeTimerRows(result.rows, [
              "avg_time_ms",
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

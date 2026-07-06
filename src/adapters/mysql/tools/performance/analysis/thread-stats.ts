import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ThreadStatsOutputSchema,
  ThreadStatsSchemaBase,
  ThreadStatsSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createThreadStatsTool(adapter: MySQLAdapter): ToolDefinition {

  return {
    name: "mysql_thread_stats",
    title: "MySQL Thread Stats",
    description: "Get thread activity statistics.",
    group: "performance",
    inputSchema: ThreadStatsSchemaBase,
    outputSchema: ThreadStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { limit } = ThreadStatsSchema.parse(params);
        const result = await adapter.executeReadQuery(`
                SELECT 
                    THREAD_ID,
                    NAME,
                    TYPE,
                    PROCESSLIST_ID,
                    PROCESSLIST_USER,
                    PROCESSLIST_HOST,
                    PROCESSLIST_DB,
                    PROCESSLIST_COMMAND,
                    PROCESSLIST_TIME,
                    PROCESSLIST_STATE,
                    CONNECTION_TYPE
                FROM performance_schema.threads
                WHERE PROCESSLIST_ID IS NOT NULL
                ORDER BY PROCESSLIST_TIME DESC
                LIMIT ${Math.min(limit, 50)}
            `);

        // Strip null values to conserve tokens
        const threads = result.rows?.map((row) => {
          const clean: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(row)) {
            if (value !== null && value !== undefined) {
              clean[key] = value;
            }
          }
          return clean;
        });

        const response = { success: true, data: { threads } };
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

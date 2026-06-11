import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import {
  ShowProcesslistSchema,
  ShowProcesslistSchemaBase,
  ShowProcesslistOutputSchema,
} from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createShowProcesslistTool(
  adapter: MySQLAdapter,
): ToolDefinition {
  return {
    name: "mysql_show_processlist",
    title: "MySQL Show Processlist",
    description: "Show all running processes and queries.",
    group: "monitoring",
    inputSchema: ShowProcesslistSchemaBase,
    outputSchema: ShowProcesslistOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { full, limit } = ShowProcesslistSchema.parse(params);
        const sql = full ? "SHOW FULL PROCESSLIST" : "SHOW PROCESSLIST";
        const result = await adapter.executeQuery(sql);
        const allRows = result.rows ?? [];
        const totalAvailable = allRows.length;
        const limited = totalAvailable > limit;
        const processes = limited ? allRows.slice(0, limit) : allRows;
        const response = {
          success: true as const,
          data: {
            processes,
            count: processes.length,
            ...(limited ? { limited: true, totalAvailable } : {}),
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

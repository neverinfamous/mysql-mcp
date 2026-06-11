import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { PoolStatsOutputSchema } from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";
import { z } from "zod";

export function createPoolStatsTool(adapter: MySQLAdapter): ToolDefinition {
  const schema = z.object({});

  return {
    name: "mysql_pool_stats",
    title: "MySQL Pool Stats",
    description: "Get connection pool statistics.",
    group: "monitoring",
    inputSchema: schema,
    outputSchema: PoolStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (_params: unknown, _context: RequestContext) => {
      try {
        const pool = await Promise.resolve(adapter.getPool());
        if (!pool) {
          return formatHandlerErrorResponse(new Error("Pool not available"));
        }
        const response = {
          success: true,
          data: { poolStats: pool.getStats() },
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

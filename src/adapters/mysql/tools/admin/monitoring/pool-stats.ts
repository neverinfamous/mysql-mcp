import type { MySQLAdapter } from "../../../mysql-adapter/index.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../../types/index.js";
import { PoolStatsSchema, PoolStatsSchemaBase, PoolStatsOutputSchema } from "../../../schemas/index.js";
import { formatHandlerErrorResponse } from "../../core/error-helpers.js";
import { MySQLMcpError } from "../../../../../types/modules/errors.js";
import { READ_ONLY } from "../../../../../utils/annotations.js";

export function createPoolStatsTool(adapter: MySQLAdapter): ToolDefinition {

  return {
    name: "mysql_pool_stats",
    title: "MySQL Pool Stats",
    description: "Get connection pool statistics.",
    group: "monitoring",
    inputSchema: PoolStatsSchemaBase,
    outputSchema: PoolStatsOutputSchema,
    requiredScopes: ["read"],
    annotations: READ_ONLY,
    handler: async (params: unknown, _context: RequestContext) => {
      try {
        const { summary } = PoolStatsSchema.parse(params);
        const pool = await Promise.resolve(adapter.getPool());
        if (!pool) {
          return formatHandlerErrorResponse(
            new MySQLMcpError("Connection pool is not configured on this server", "POOL_NOT_CONFIGURED", "validation")
          );
        }
        const stats = pool.getStats();
        const response = {
          success: true,
          data: { 
            poolStats: summary ? { total: stats.total, active: stats.active } : stats,
            ...(summary ? { summary: true } : {})
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

/**
 * MySQL Resource - Pool
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createPoolResource(adapter: MySQLAdapter): ResourceDefinition {
  return {
    uri: "mysql://pool",
    name: "Connection Pool",
    title: "MySQL Connection Pool",
    description: "Connection pool statistics",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.7,
    },
    handler: (_uri: string, _context: RequestContext) => {
      const pool = adapter.getPool();
      if (!pool) {
        return Promise.resolve({ error: "Pool not available" });
      }
      return Promise.resolve({ poolStats: pool.getStats() });
    },
  };
}

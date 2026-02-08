/**
 * MySQL Resource - sys Schema
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createSysSchemaResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://sysschema",
    name: "sys Schema Diagnostics",
    title: "MySQL sys Schema Summary",
    description: "Key diagnostic information from MySQL sys schema views",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.7,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      try {
        // Top resource consumers
        const usersResult = await adapter.executeQuery(`
                    SELECT user, total_connections, current_connections, 
                           total_memory_allocated as memory_bytes
                    FROM sys.user_summary
                    ORDER BY total_memory_allocated DESC
                    LIMIT 5
                `);

        // Slow statements
        const statementsResult = await adapter.executeQuery(`
                    SELECT SUBSTRING(query, 1, 100) as query_preview,
                           exec_count, total_latency, avg_latency
                    FROM sys.statements_with_runtimes_in_95th_percentile
                    LIMIT 5
                `);

        // Current lock waits
        const locksResult = await adapter.executeQuery(`
                    SELECT COUNT(*) as lock_wait_count FROM sys.innodb_lock_waits
                `);
        const lockRow = locksResult.rows?.[0];

        return {
          available: true,
          topUsers: usersResult.rows ?? [],
          slowStatements: statementsResult.rows ?? [],
          currentLockWaits: Number(lockRow?.["lock_wait_count"] ?? 0),
        };
      } catch {
        return {
          available: false,
          message: "sys schema not available or insufficient privileges",
        };
      }
    },
  };
}

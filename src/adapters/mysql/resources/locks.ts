/**
 * MySQL Resource - Locks
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createLocksResource(adapter: MySQLAdapter): ResourceDefinition {
  return {
    uri: "mysql://locks",
    name: "Lock Contention",
    title: "MySQL Lock Contention",
    description: "Current InnoDB lock waits and blocking transactions",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.8,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      try {
        // Get current lock waits from performance_schema
        const lockWaitsResult = await adapter.executeQuery(`
                    SELECT 
                        r.trx_id AS waiting_trx_id,
                        r.trx_mysql_thread_id AS waiting_thread,
                        r.trx_query AS waiting_query,
                        b.trx_id AS blocking_trx_id,
                        b.trx_mysql_thread_id AS blocking_thread,
                        b.trx_query AS blocking_query,
                        TIMESTAMPDIFF(SECOND, r.trx_wait_started, NOW()) AS wait_seconds
                    FROM performance_schema.data_lock_waits w
                    JOIN information_schema.innodb_trx r ON r.trx_id = w.REQUESTING_ENGINE_TRANSACTION_ID
                    JOIN information_schema.innodb_trx b ON b.trx_id = w.BLOCKING_ENGINE_TRANSACTION_ID
                    LIMIT 20
                `);

        // Get global lock status
        const lockStatusResult = await adapter.executeQuery(`
                    SHOW STATUS LIKE 'Innodb_row_lock%'
                `);

        const lockStats: Record<string, unknown> = {};
        for (const row of lockStatusResult.rows ?? []) {
          const varName = row["Variable_name"];
          if (typeof varName === "string") {
            lockStats[varName] = row["Value"];
          }
        }

        return {
          currentLockWaits: lockWaitsResult.rows?.length ?? 0,
          lockWaits: lockWaitsResult.rows ?? [],
          lockStatistics: lockStats,
        };
      } catch {
        return {
          currentLockWaits: 0,
          lockWaits: [],
          lockStatistics: {},
          error: "Unable to retrieve lock information",
        };
      }
    },
  };
}

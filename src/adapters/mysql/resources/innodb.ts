/**
 * MySQL Resource - InnoDB
 *
 * InnoDB buffer pool and engine status metrics.
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createInnodbResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://innodb",
    name: "InnoDB Status",
    title: "MySQL InnoDB Status",
    description: "InnoDB buffer pool statistics and engine status",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.7,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      // Performance optimization: run all three independent queries in parallel
      const [bufferPoolResult, configResult, opsResult] = await Promise.all([
        // Get buffer pool status
        adapter.executeQuery(`
                SHOW GLOBAL STATUS WHERE Variable_name LIKE 'Innodb_buffer_pool%'
            `),
        // Get buffer pool size configuration
        adapter.executeQuery(`
                SHOW GLOBAL VARIABLES WHERE Variable_name IN (
                    'innodb_buffer_pool_size', 'innodb_buffer_pool_instances',
                    'innodb_log_file_size', 'innodb_log_files_in_group',
                    'innodb_flush_log_at_trx_commit', 'innodb_file_per_table'
                )
            `),
        // Get row operations
        adapter.executeQuery(`
                SHOW GLOBAL STATUS WHERE Variable_name IN (
                    'Innodb_rows_read', 'Innodb_rows_inserted', 
                    'Innodb_rows_updated', 'Innodb_rows_deleted',
                    'Innodb_data_reads', 'Innodb_data_writes',
                    'Innodb_os_log_written', 'Innodb_log_writes'
                )
            `),
      ]);

      const bufferPool: Record<string, number> = {};
      for (const row of bufferPoolResult.rows ?? []) {
        bufferPool[row["Variable_name"] as string] = parseInt(
          row["Value"] as string,
          10,
        );
      }

      const config: Record<string, string> = {};
      for (const row of configResult.rows ?? []) {
        config[row["Variable_name"] as string] = row["Value"] as string;
      }

      const operations: Record<string, number> = {};
      for (const row of opsResult.rows ?? []) {
        operations[row["Variable_name"] as string] = parseInt(
          row["Value"] as string,
          10,
        );
      }

      // Calculate buffer pool efficiency
      const readRequests = bufferPool["Innodb_buffer_pool_read_requests"] ?? 0;
      const reads = bufferPool["Innodb_buffer_pool_reads"] ?? 0;
      const hitRatio =
        readRequests > 0
          ? Math.round(((readRequests - reads) / readRequests) * 100 * 100) /
            100
          : 100;

      const pagesTotal = bufferPool["Innodb_buffer_pool_pages_total"] ?? 0;
      const pagesFree = bufferPool["Innodb_buffer_pool_pages_free"] ?? 0;
      const pagesData = bufferPool["Innodb_buffer_pool_pages_data"] ?? 0;
      const pagesDirty = bufferPool["Innodb_buffer_pool_pages_dirty"] ?? 0;

      return {
        buffer_pool: {
          size_bytes: parseInt(config["innodb_buffer_pool_size"] ?? "0", 10),
          instances: parseInt(
            config["innodb_buffer_pool_instances"] ?? "1",
            10,
          ),
          hit_ratio_percent: hitRatio,
          pages: {
            total: pagesTotal,
            free: pagesFree,
            data: pagesData,
            dirty: pagesDirty,
            dirty_percent:
              pagesTotal > 0 ? Math.round((pagesDirty / pagesTotal) * 100) : 0,
          },
          read_requests: readRequests,
          reads: reads,
          write_requests: bufferPool["Innodb_buffer_pool_write_requests"] ?? 0,
        },
        configuration: {
          buffer_pool_size: config["innodb_buffer_pool_size"],
          log_file_size: config["innodb_log_file_size"],
          log_files_in_group: config["innodb_log_files_in_group"],
          flush_log_at_trx_commit: config["innodb_flush_log_at_trx_commit"],
          file_per_table: config["innodb_file_per_table"],
        },
        row_operations: {
          reads: operations["Innodb_rows_read"] ?? 0,
          inserts: operations["Innodb_rows_inserted"] ?? 0,
          updates: operations["Innodb_rows_updated"] ?? 0,
          deletes: operations["Innodb_rows_deleted"] ?? 0,
        },
        io: {
          data_reads: operations["Innodb_data_reads"] ?? 0,
          data_writes: operations["Innodb_data_writes"] ?? 0,
          log_writes: operations["Innodb_log_writes"] ?? 0,
          os_log_written: operations["Innodb_os_log_written"] ?? 0,
        },
      };
    },
  };
}

/**
 * MySQL Resource - Performance
 *
 * Query performance metrics and slow query information.
 */
import type { MySQLAdapter } from "../MySQLAdapter.js";
import type {
  ResourceDefinition,
  RequestContext,
} from "../../../types/index.js";

export function createPerformanceResource(
  adapter: MySQLAdapter,
): ResourceDefinition {
  return {
    uri: "mysql://performance",
    name: "Performance Metrics",
    title: "MySQL Performance Metrics",
    description: "Query performance statistics and slow query analysis",
    mimeType: "application/json",
    annotations: {
      audience: ["user", "assistant"],
      priority: 0.8,
    },
    handler: async (_uri: string, _context: RequestContext) => {
      // Get performance-related status variables
      const statusResult = await adapter.executeQuery(`
                SHOW GLOBAL STATUS WHERE Variable_name IN (
                    'Queries', 'Questions', 'Slow_queries',
                    'Select_full_join', 'Select_range_check', 'Select_scan',
                    'Sort_merge_passes', 'Sort_range', 'Sort_rows', 'Sort_scan',
                    'Created_tmp_disk_tables', 'Created_tmp_tables',
                    'Handler_read_first', 'Handler_read_key', 'Handler_read_rnd',
                    'Handler_read_rnd_next', 'Handler_write'
                )
            `);

      const status: Record<string, number> = {};
      for (const row of statusResult.rows ?? []) {
        status[row["Variable_name"] as string] = parseInt(
          row["Value"] as string,
          10,
        );
      }

      // Get performance schema if available (MySQL 5.6+)
      let topQueries: unknown[] = [];
      try {
        const perfResult = await adapter.executeQuery(`
                    SELECT 
                        DIGEST_TEXT as query_pattern,
                        COUNT_STAR as execution_count,
                        ROUND(SUM_TIMER_WAIT / 1000000000, 2) as total_time_ms,
                        ROUND(AVG_TIMER_WAIT / 1000000000, 2) as avg_time_ms,
                        ROUND(MAX_TIMER_WAIT / 1000000000, 2) as max_time_ms,
                        SUM_ROWS_EXAMINED as rows_examined,
                        SUM_ROWS_SENT as rows_sent
                    FROM performance_schema.events_statements_summary_by_digest
                    WHERE DIGEST_TEXT IS NOT NULL
                    ORDER BY SUM_TIMER_WAIT DESC
                    LIMIT 10
                `);
        topQueries = perfResult.rows ?? [];
      } catch {
        // Performance schema may not be available
      }

      // Calculate derived metrics
      const tmpTablesCreated = status["Created_tmp_tables"] ?? 0;
      const tmpDiskRatio =
        tmpTablesCreated > 0
          ? Math.round(
              ((status["Created_tmp_disk_tables"] ?? 0) / tmpTablesCreated) *
                100,
            )
          : 0;

      const fullTableScans = status["Handler_read_rnd_next"] ?? 0;
      const indexReads = status["Handler_read_key"] ?? 0;
      const scanVsIndexRatio =
        fullTableScans + indexReads > 0
          ? Math.round((fullTableScans / (fullTableScans + indexReads)) * 100)
          : 0;

      return {
        summary: {
          total_queries: status["Queries"] ?? 0,
          slow_queries: status["Slow_queries"] ?? 0,
          tmp_tables_to_disk_percent: tmpDiskRatio,
          full_scan_percent: scanVsIndexRatio,
        },
        sorts: {
          merge_passes: status["Sort_merge_passes"] ?? 0,
          range: status["Sort_range"] ?? 0,
          rows: status["Sort_rows"] ?? 0,
          scan: status["Sort_scan"] ?? 0,
        },
        joins: {
          full_join: status["Select_full_join"] ?? 0,
          range_check: status["Select_range_check"] ?? 0,
          scan: status["Select_scan"] ?? 0,
        },
        handler: {
          read_key: status["Handler_read_key"] ?? 0,
          read_rnd: status["Handler_read_rnd"] ?? 0,
          read_rnd_next: status["Handler_read_rnd_next"] ?? 0,
          write: status["Handler_write"] ?? 0,
        },
        top_queries: topQueries,
      };
    },
  };
}

# Sys Schema Tools

Tools: `mysql_sys_user_summary`, `mysql_sys_io_summary`, `mysql_sys_statement_summary`, `mysql_sys_wait_summary`, `mysql_sys_innodb_lock_waits`, `mysql_sys_schema_stats`, `mysql_sys_host_summary`, `mysql_sys_memory_summary`
- **User/Host activity**: `mysql_sys_user_summary` and `mysql_sys_host_summary` show connection counts, statement latency, and I/O metrics. Filter with `user` or `host` parameters.
- **Statement analysis**: `mysql_sys_statement_summary` returns query digest stats (default `limit: 5`). Order by `total_latency` (default), `exec_count`, `avg_latency`, `rows_sent`, or `rows_examined`.
- **I/O analysis**: `mysql_sys_io_summary` supports `table` (default), `file`, and `global` types for I/O breakdown (default `limit: 5`).
- **Wait events**: `mysql_sys_wait_summary` supports `global` (default), `by_host`, `by_user`, and `by_instance` types for wait analysis. The `by_instance` type queries `performance_schema` directly (no sys view exists) and returns `event`, `total`, `total_latency`, and `avg_latency` columns with formatted latencies.
- **Lock contention**: `mysql_sys_innodb_lock_waits` shows active lock waits. Returns `hasContention: false` when none.
- **Memory usage**: `mysql_sys_memory_summary` returns `globalMemory` (by event type) and `memoryByUser` arrays with corresponding `globalMemoryCount` and `memoryByUserCount` fields. The `limit` parameter (default 5) applies to both arrays.
- **Schema stats**: `mysql_sys_schema_stats` returns 3 arrays: `tableStatistics` (DML and I/O per table), `indexStatistics` (per-index usage), and `autoIncrementStatus` (usage ratios), each with a corresponding count field (`tableStatisticsCount`, `indexStatisticsCount`, `autoIncrementStatusCount`). Filter by `schema` (defaults to current database). Returns `{ success: false, error }` when the specified schema does not exist. The `limit` parameter (default 5) applies per array.

### Example: Wait Summary
```json
{
  "type": "by_instance",
  "limit": 10
}
```

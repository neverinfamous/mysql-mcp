# Performance Tools (`mysql_explain`, `mysql_query_stats`, etc.)

- **EXPLAIN formats**: `mysql_explain` supports JSON (default), TREE, and TRADITIONAL formats.
- **EXPLAIN ANALYZE**: `mysql_explain_analyze` shows actual execution times (MySQL 8.0+). Only TREE format is supported; JSON format returns `{ supported: false, reason }`.
- **Performance schema**: `mysql_slow_queries`, `mysql_query_stats`, and `mysql_index_usage` require `performance_schema` enabled. `mysql_slow_queries` and `mysql_query_stats` truncate query digests to 200 characters for payload efficiency. Timer values exceeding 24 hours are clamped to `-1` with `overflow: true` on the row (indicates a `performance_schema` counter overflow artifact, not a real value).
- **Index usage**: `mysql_index_usage` filters to the current database by default. Use `table` parameter to filter further. Use `limit` (default: 10) to cap results. Returns `{ exists: false, table }` when the specified table does not exist.
- **Table stats**: `mysql_table_stats` returns `{ exists: false, table: "..." }` gracefully when the table does not exist.
- **Server-level tools**: `mysql_slow_queries`, `mysql_query_stats`, `mysql_buffer_pool_stats`, and `mysql_thread_stats` query server-level `performance_schema` metadata. They do not take a table parameter and return empty results when no data is available. No table existence checks apply.
- **Buffer pool**: `mysql_buffer_pool_stats` shows InnoDB memory usage and hit rates.
- **Thread stats**: `mysql_thread_stats` shows active threads with user, host, database, command, and connection type.
- **Error handling**: `mysql_explain` and `mysql_explain_analyze` return `{ exists: false, error }` for nonexistent tables and `{ success: false, error }` for other query errors (e.g., syntax errors). No raw MySQL errors are thrown.

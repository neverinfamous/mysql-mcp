# Performance Tools (`mysql_explain`, `mysql_query_stats`, etc.)

**Encapsulated Tools**: `mysql_explain`, `mysql_explain_analyze`, `mysql_slow_queries`, `mysql_query_stats`, `mysql_index_usage`, `mysql_table_stats`, `mysql_buffer_pool_stats`, `mysql_thread_stats`, `mysql_detect_query_anomalies`, `mysql_detect_bloat_risk`, `mysql_detect_connection_spike`

### Query Analysis (`mysql_explain`, `mysql_explain_analyze`)
- **EXPLAIN**: Supports JSON (default), TREE, and TRADITIONAL formats.
- **EXPLAIN ANALYZE**: Shows actual execution times (MySQL 8.0+). Only TREE format is supported. JSON format returns `{ supported: false, reason: "..." }`.
- **Error Handling**: Missing tables return `{ exists: false, error }`, other query errors (syntax) return `{ success: false, error }`.

### Performance Schema (`mysql_slow_queries`, `mysql_query_stats`, `mysql_index_usage`, `mysql_buffer_pool_stats`, `mysql_thread_stats`)
- **Requirements**: Requires `performance_schema` enabled.
- **Data Limits**: `mysql_slow_queries` and `mysql_query_stats` truncate query digests to 200 chars. Timers > 24 hours are clamped to `-1` with `overflow: true`.
- **Server-Level Tools**: `mysql_slow_queries`, `mysql_query_stats`, `mysql_buffer_pool_stats`, `mysql_thread_stats` are server-level. No table parameter required. If no data, they return empty results.
- **Index Usage**: `mysql_index_usage` filters to the current database by default. Returns `{ exists: false, table }` if the specific table doesn't exist.

### Table Statistics (`mysql_table_stats`)
- Returns gracefully with `{ exists: false, table: "..." }` if the table is missing.

### Detectors (`mysql_detect_query_anomalies`, `mysql_detect_bloat_risk`, `mysql_detect_connection_spike`)
- **Query Anomalies**: Identifies queries with execution times exceeding standard deviation thresholds.
- **Bloat Risk**: Scans for tables with significant data/index fragmentation.
- **Connection Spikes**: Analyzes recent connection rates against baselines to flag potential spikes or leaks.

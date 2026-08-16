# Critical Gotchas & Always-Available Reference

## Server Identity

- **Server Name**: This primary server is identified as `user-mysql` in MCP client configurations.
- **Ecosystem Server**: Ecosystem tools (Cluster, ProxySQL, Router, Shell) require the `mysql-ecosystem` server connection. If you are targeting these specific tools, use `mysql-ecosystem` instead of `user-mysql`.
- **Tool Invocation**: When calling tools via MCP, they are prefixed with the server name (e.g., `user-mysql-mysql_json_extract`, `mysql-ecosystem-mysqlsh_version`).
- **Resources**:
  - Resources use the `mysql://` URI scheme (e.g., `mysql://capabilities`, `mysql://schema`).
  - When listing or fetching resources, use the corresponding server name (e.g., `fetch_mcp_resource(server: "user-mysql", uri: "mysql://schema")`).

## Code Mode

- **Code Mode Execution**: Advanced tool interactions, testing, and script executions are verified via `mysql_execute_code` (Code Mode), which evaluates logic inside an isolated Node.js VM.

## Parameter Aliases

Many tools accept **alternative parameter names** (aliases) for commonly used fields. The server normalizes these automatically—use whichever feels most natural:

- **Table name**: `table`, `tableName`, `name`, `tbl`, or `table_name` — accepted by Core tools (`mysql_describe_table`, `mysql_get_indexes`, `mysql_drop_table`, `mysql_create_index`, `mysql_enable_versioning`, `mysql_disable_versioning`, `mysql_check_version`, `mysql_conditional_update`), Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`), Backup tools (`mysql_export_table`, `mysql_import_data`), Shell tools (`mysqlsh_export_table`, `mysqlsh_import_table`, `mysqlsh_import_json`), Partitioning tools (`mysql_partition_info`, `mysql_add_partition`, `mysql_drop_partition`, `mysql_reorganize_partition`), Performance tools (`mysql_table_stats`, `mysql_index_usage`, `mysql_detect_bloat_risk`), Optimization tools (`mysql_index_recommendation`, `mysql_force_index`), Vector tools (`mysql_vector_info`, `mysql_vector_create_index`, `mysql_vector_optimize`, `mysql_vector_stats`, `mysql_vector_store`, `mysql_vector_batch_store`, `mysql_vector_delete`, `mysql_vector_get`, `mysql_vector_search`, `mysql_vector_range_search`, `mysql_vector_hybrid_search`), Spatial tools (`mysql_spatial_create_column`, `mysql_spatial_create_index`, `mysql_spatial_distance`, `mysql_spatial_distance_sphere`, `mysql_spatial_contains`, `mysql_spatial_within`), Stats tools, and Admin tools (`mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, `mysql_repair_table`, `mysql_flush_tables`).
- **Trigger name**: `name` or `triggerName`
- **Query/SQL/Trigger body**: `query` or `sql` — accepted by `mysql_read_query`, `mysql_write_query`, `mysql_explain`, `mysql_explain_analyze`, `mysql_query_rewrite`, and `mysql_optimizer_trace`. Also `queries` (array) accepted by `mysql_index_recommendation`. `query` is also an alias for `queryText` in `mysql_vector_hybrid_search` and an alias for `pattern`/`value` in `mysql_regexp_match`, `mysql_like_search`, and `mysql_soundex`. Trigger bodies can use `body`, `statement`, or `definition`.
- **Vector Parameters**: `vector` is an alias for `queryVector` in vector search tools (`mysql_vector_search`, `mysql_vector_range_search`, `mysql_vector_hybrid_search`). `distance` is an alias for `maxDistance` in `mysql_vector_range_search`.
- **WHERE clause**: `where` or `filter` — accepted by `mysql_export_table` and Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`).
- **Column name**: `column` or `col` — accepted by Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_collation_convert`). Spatial tools also accept `spatialColumn` or `geometryColumn` as aliases for `column`.
- **Result column alias**: `alias` or `as` — accepted by `mysql_concat` and `mysql_collation_convert`.
- **Substring constraints**: `start` accepts `pos` or `position`. `length` accepts `len` — accepted by `mysql_substring`.
- **Process ID**: `processId` or `id` — accepted by `mysql_kill_query`.
- **Script Path**: `path` or `scriptPath` — accepted by `mysqlsh_run_script`.
- **Input/Output Path**: `path`, `url`, `file`, `filepath` — accepted by Backup and Shell tools.
- **Router targets**: `routeName`, `metadataName`, `poolName`, or simply `name` — accepted by all Router REST API tools.
- **Admin tables array**: Admin maintenance tools accept a singular `table` (or `tableName`/`name`) as an alias for the `tables` array parameter, automatically wrapping it in an array.

## Pagination & Limits

- **Default LIMIT 50**: `mysql_read_query`, `mysql_json_extract`, `mysql_json_contains`, `mysql_json_search`, and Text tools (`mysql_like_search`, `mysql_regexp_match`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`) inject a default `LIMIT 50` on queries without an explicit `LIMIT` clause. Use `cursor`/`nextCursor` to page through results (only supported by `mysql_read_query`). Add your own `LIMIT` clause to override this default.
- **Default LIMIT 1**: `mysql_json_get` and `mysql_json_keys` strictly enforce a `LIMIT 1`.
- **Administrative Defaults**: `mysql_export_table` defaults to a `limit` of 5 and `batch` size of 50. The `mysql_sys_` schema tools default to `limit` values between 5 and 10. `mysql_audit_search` defaults to `limit: 5`.
- **Faceted Search**: Fulltext tools accept `includeFacets: true` to return per-column hit distributions alongside results.

## Typed Error Codes

All errors carry a `code` field for programmatic handling:

| Code | Category | Recoverable | When |
|---|---|---|---|
| `TIMEOUT_ERROR` | connection | ✅ | Query or connection exceeded time limit |
| `RATE_LIMIT_ERROR` | connection | ✅ | Too many requests — wait and retry |
| `CONFLICT_ERROR` | query | ✅ | Optimistic concurrency version mismatch |
| `EXTENSION_MISSING` | config | ❌ | Required MySQL plugin/extension not loaded |

Recoverable errors can be retried. Check `recoverable: true` in the response.


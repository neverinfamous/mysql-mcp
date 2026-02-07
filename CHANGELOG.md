# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`mysql_cluster_status` Full-Mode Payload Reduction** — Strips `GuidelinesSchema` and `ConfigurationChangesSchema` from `router_options` JSON in full (non-summary) mode. These static Router version metadata schemas accounted for ~10KB of the response without providing dynamic cluster state information.
- **`mysql_cluster_router_status` Full-Mode Payload Reduction** — Strips the `Configuration` blob from router `attributes` JSON in full (non-summary) mode. The per-endpoint SSL/connection configs were repeated ~5× with largely identical values, accounting for ~12KB per router.
- **`mysql_cluster_instances` Offline Node Reporting** — Instances registered in cluster metadata but not active in the Group Replication group now report `memberState: 'OFFLINE'` and `memberRole: 'NONE'` instead of `null`, making offline nodes immediately identifiable.
- **`mysql_cluster_topology` Offline Instance Visibility** — Topology visualization now cross-references `mysql_innodb_cluster_metadata.instances` against active GR members to detect nodes that are registered in metadata but offline. These appear in the `offline` array and ASCII visualization with `source: 'metadata'`.
- **`mysql_cluster_switchover` Zero-Secondary Warning** — When no online secondaries exist, the warning now reads `"No online secondaries available for switchover."` instead of the misleading `"All secondaries have significant replication lag."` which implied secondaries existed but were lagging.
- **`proxysql_global_variables` Credential Redaction** — Variables whose names contain `password` or `credentials` (e.g., `admin-admin_credentials`, `mysql-monitor_password`, `admin-cluster_password`) now have their values replaced with `********` instead of exposing plaintext credentials.
- **`proxysql_runtime_status` Credential Redaction** — Admin variables containing `password` or `credentials` are now automatically redacted, matching the pattern applied to `proxysql_global_variables`.
- **`proxysql_runtime_status` Full Admin Variables** — Removed hardcoded `LIMIT 20` truncation that hid admin variables beyond the first 20. Now returns all admin variables with sensitive values redacted.
- **`proxysql_hostgroups` Response Consistency** — Added missing `count` field to response for parity with `proxysql_connection_pool`, which already included it.
- **`proxysql_memory_stats` Response Consistency** — Added missing `count` field to response for parity with all other list-returning ProxySQL tools (`proxysql_servers`, `proxysql_users`, `proxysql_process_list`, etc.).
- **`mysql_router_pool_status` Description Accuracy** — Fixed tool description claiming response includes "reused connections" when the actual Router REST API returns `idleServerConnections` and `stashedServerConnections`. Updated description and test mock data to match real API response fields.
- **`mysql_doc_drop_collection` Informative Absent Collection Messaging** — When `ifExists: true` (default), the tool now pre-checks collection existence and returns `{ success: true, collection, message: "Collection did not exist" }` when the collection was already absent, instead of a plain `{ success: true }` that was indistinguishable from an actual drop. Matches the informative messaging pattern used by other tool groups.
- **Docstore Tools Graceful Error Handling (P154)** — `mysql_doc_create_collection` returns `{ success: false, reason }` for duplicate collections (without `ifNotExists`). `mysql_doc_drop_collection` returns `{ success: false, reason }` for nonexistent collections (without `ifExists`). `mysql_doc_collection_info`, `mysql_doc_add`, `mysql_doc_modify`, `mysql_doc_remove`, and `mysql_doc_create_index` return `{ exists: false, collection }` for nonexistent collections. `mysql_doc_create_index` also returns `{ success: false, reason }` for duplicate index/generated columns. Previously all propagated raw MySQL errors.
- **`mysql_role_revoke` User Existence Pre-Check** — Fixed `mysql_role_revoke` returning the "not assigned" message for nonexistent users instead of distinguishing them from valid users with unassigned roles. Now pre-checks `mysql.user` before the `role_edges` assignment check and returns `{ success: false, error: "User does not exist" }` for nonexistent users, matching `mysql_role_assign` behavior.
- **`mysql_role_revoke` Assignment Pre-Check** — Fixed `mysql_role_revoke` returning `success: true` when revoking a role that was not assigned to the user. Now pre-checks `mysql.role_edges` and returns `{ success: false, reason: "Role '...' is not assigned to user '...'@'...'" }` when the role is not currently assigned.
- **`mysql_role_grant` Error Message Sanitization** — Fixed `mysql_role_grant` leaking internal adapter prefix (`Raw query failed: Query failed:`) in error messages for nonexistent tables. Now strips the prefix to return clean MySQL error messages (e.g., `"Table 'testdb.nonexistent' doesn't exist"`).
- **Roles Tool Graceful Error Handling** — `mysql_role_create` returns `{ success: false, reason }` for duplicate roles (without `ifNotExists`). `mysql_role_drop` returns `{ success: false, reason }` for nonexistent roles (without `ifExists`). `mysql_role_assign` and `mysql_role_revoke` return `{ success: false, error }` for nonexistent users. `mysql_role_grant` returns `{ success: false, error }` for nonexistent tables. `mysql_user_roles` returns `{ exists: false }` for nonexistent users (P154). Previously all propagated raw MySQL errors.
- **Stats Tools Graceful Error Handling (P154)** — All 8 stats tools (`mysql_stats_descriptive`, `mysql_stats_percentiles`, `mysql_stats_correlation`, `mysql_stats_distribution`, `mysql_stats_time_series`, `mysql_stats_regression`, `mysql_stats_sampling`, `mysql_stats_histogram`) now return `{ exists: false, table }` for nonexistent tables and `{ success: false, error }` for other query errors (e.g., unknown column), instead of propagating raw MySQL errors.
- **Spatial Tools Graceful Error Handling (P154)** — All 12 spatial tools now handle errors gracefully. Table-querying tools (`mysql_spatial_distance`, `mysql_spatial_distance_sphere`, `mysql_spatial_contains`, `mysql_spatial_within`, `mysql_spatial_create_column`, `mysql_spatial_create_index`) return `{ exists: false, table }` for nonexistent tables. `mysql_spatial_create_column` returns `{ success: false, reason }` for duplicate columns. All tools return `{ success: false, error }` for invalid WKT, coordinates, SRIDs, and other MySQL errors instead of propagating raw exceptions.
- **`mysql_spatial_create_index` Nullable Column Handling** — Tool now returns `{ success: false, reason }` with an actionable ALTER TABLE suggestion when the target column is nullable, instead of throwing a raw error. Consistent with P154 graceful error handling across all spatial tools.
- **`mysql_stats_histogram` Table Existence Check (P154)** — Tool now performs explicit table existence check via `information_schema.TABLES` before querying histogram metadata or executing `ANALYZE TABLE`, correctly distinguishing between a nonexistent table and a table without a histogram.
- **`mysql_stats_histogram` Column Existence Check** — Tool now validates that the column exists on the table via `information_schema.COLUMNS` before querying histogram metadata. Returns `{ exists: false, column, table, message }` for nonexistent columns, distinguishing them from valid columns with no histogram.
- **`mysql_partition_info` Existence Check (P154)** — Returns `{ exists: false, table }` when the table does not exist, instead of the generic `{ partitioned: false }` response previously returned for both nonexistent and non-partitioned tables.
- **Partitioning Write Tools Graceful Error Handling** — `mysql_add_partition`, `mysql_drop_partition`, and `mysql_reorganize_partition` now return structured `{ success: false, error }` responses for common failures (non-partitioned table, nonexistent partition, MAXVALUE conflicts, duplicate values) instead of propagating raw MySQL errors.
- **`mysql_binlog_events` Graceful Error Handling (P154)** — Tool now returns `{ success: false, logFile, error }` when the specified binlog file does not exist, instead of propagating a raw MySQL error. Also handles generic binlog query failures gracefully with `{ success: false, error }`.
- **Shell Tool Error Handling** — `mysqlsh_export_table` and `mysqlsh_dump_instance` now catch privilege/access-denied errors and provide actionable guidance instead of propagating raw errors. `mysqlsh_dump_instance` also catches fatal dump errors with fallback suggestions.
- **Schema Tool Graceful Error Handling** — `mysql_create_schema` returns `{ success: false, reason }` when the schema already exists (without `ifNotExists`), `mysql_drop_schema` returns `{ success: false, reason }` when the schema does not exist (without `ifExists`), and `mysql_create_view` returns `{ success: false, reason }` when the view already exists (without `orReplace`) or when the SQL definition is invalid (e.g., referencing nonexistent tables). Previously all three propagated raw MySQL errors.
- **`mysql_list_constraints` Existence Check (P154)** — Returns `{ exists: false, table }` when the table does not exist, instead of returning an empty constraints array indistinguishable from a table with no constraints.
- **Events Tool Graceful Error Handling** — `mysql_event_create` returns `{ success: false, reason }` for duplicate events (errno 1537), `mysql_event_alter` and `mysql_event_drop` (without `ifExists`) return `{ success: false, reason }` for nonexistent events (errno 1539), instead of propagating raw MySQL errors.
- **`mysql_event_status` Existence Check (P154)** — Returns `{ exists: false, name }` when the event is not found, instead of throwing a raw error.
- **`mysql_sys_wait_summary` by_instance Output Normalization** — The `by_instance` type now returns human-readable formatted latencies (`total_latency`, `avg_latency`) using `FORMAT_PICO_TIME()` and consistent column aliases (`event`, `total`, `instance`), matching the output format of `global`, `by_host`, and `by_user` types. Previously returned raw picosecond values with inconsistent field names (`event_name`, `count_star`, `sum_timer_wait`).
- **`mysql_stats_time_series` Week Interval Format** — Fixed `interval: "week"` producing ambiguous period format (`2026-06`) indistinguishable from month format (`2026-02`). Changed `DATE_FORMAT` from `%Y-%u` to `%x-W%v`, producing unambiguous ISO week format (e.g., `2026-W06`).
- **`mysql_stats_distribution` Bucket Off-by-One** — Fixed requesting N buckets but receiving N+1 entries when the maximum value falls exactly on a bucket boundary. Added `LEAST()` clamp to ensure the max value is included in the last bucket instead of creating an extra one.
- **`mysql_security_user_privileges` Summary Truncation Indicator** — Summary mode (`summary: true`) silently capped `globalPrivileges` to 10 entries with no way for consumers to detect truncation. Now includes `totalGlobalPrivileges` field showing the full deduplicated count alongside the truncated array.
- **`mysql_query_rewrite` EXPLAIN Error Reporting** — Tool now returns `explainPlan: null` with `explainError` field when EXPLAIN fails (e.g., nonexistent table), instead of silently omitting the explain plan.
- **`mysql_force_index` Index Validation** — Tool now validates index existence and returns a `warning` field when the specified index is not found on the table, instead of silently generating an invalid query.
- **`mysql_optimizer_trace` Graceful Error Handling (P154)** — Tool now returns `{ query, trace: null, error }` (or `{ query, decisions: [], error }` in summary mode) when the query fails (e.g., nonexistent table), instead of propagating raw MySQL errors. Optimizer trace is still properly disabled in the `finally` block.
- **`mysql_transaction_execute` SELECT Row Data** — Fixed tool not returning row data for SELECT statements within atomic transactions. Previously returned only `{ statement: 1 }` with no rows. Now returns `rows` and `rowCount` for SELECT statements, and `rowsAffected` for write statements.
- **`mysql_json_contains` Minimal Payload (P137)** — Tool now returns only `id` and the searched JSON column instead of all columns (`SELECT *`). Reduces payload size for tables with many columns or large non-JSON fields.
- **`mysql_json_search` Minimal Payload (P137)** — Tool now returns only `id`, the searched JSON column, and `match_path` instead of all columns (`SELECT *`). Matches the minimal-payload pattern applied to fulltext and text tools.
- **`mysql_create_index` FULLTEXT/SPATIAL SQL Generation** — Fixed tool generating invalid SQL for FULLTEXT and SPATIAL index types. The tool was using `USING FULLTEXT`/`USING SPATIAL` syntax (only valid for BTREE/HASH), which produced `CREATE INDEX ... USING FULLTEXT ON ...` instead of the correct `CREATE FULLTEXT INDEX ... ON ...` prefix syntax. FULLTEXT and SPATIAL types now correctly use prefix placement, while BTREE and HASH continue to use the `USING` clause. Also prevents invalid `UNIQUE FULLTEXT` combinations.
- **`mysql_explain_analyze` JSON Format Handling** — Tool now returns `{ supported: false, reason }` gracefully when JSON format is requested, instead of propagating a raw MySQL error. MySQL EXPLAIN ANALYZE only supports TREE format.
- **`mysql_table_stats` Existence Check (P154)** — Tool now returns `{ exists: false, table: "..." }` gracefully when the table does not exist, instead of returning `{ stats: undefined }`. Follows the same pattern used by `mysql_describe_table` and `mysql_get_indexes`.
- **`mysqlsh_check_upgrade` Enhanced Response** — Tool now returns structured upgrade check results including `errorCount`, `warningCount`, `noticeCount`, `checksPerformed`, `serverVersion`, and `targetVersion` instead of just `{ success: true }`. Forces JSON output internally for reliable parsing.
- **Backup Tools Server Instructions** — Added comprehensive Backup Tools section documenting export formats (SQL/CSV), the new `limit` parameter, WHERE filtering, CSV JSON column escaping notes, import prerequisites, and dump command behavior.
- **Partitioning Tools Server Instructions** — Clarified `value` parameter documentation to distinguish between LIST (integer values like `1,2,3`) and LIST COLUMNS (quoted string values like `'region1','region2'`).
- **Schema Tools Server Instructions** — Added Schema Tools section documenting schema management (`mysql_list_schemas`, `mysql_create_schema`, `mysql_drop_schema`), view operations (`mysql_list_views`, `mysql_create_view`), and introspection tools for procedures, functions, triggers, events, and constraints.
- **Events Tools Server Instructions** — Added Events Tools section documenting scheduler status, event types (ONE TIME vs RECURRING), event lifecycle (`enabled`, `onCompletion`), alter operations, and cross-schema queries.
- **Sys Schema Tools Server Instructions** — Added Sys Schema Tools section documenting user/host summaries, statement analysis, I/O analysis, wait events, lock contention, memory usage, and schema stats tools.
- **Stats Tools Server Instructions** — Added Stats Tools section documenting descriptive statistics, percentiles, correlation, distribution, time series, regression, sampling, and histogram tools.
- **Security Tools Server Instructions** — Added Security Tools section documenting SSL status, encryption status, password validation (component requirement), data masking types, user privileges, sensitive tables detection, and Enterprise features availability.
- **ProxySQL Tools Server Instructions** — Added ProxySQL Tools section documenting prerequisites (port 6032, admin credentials, `PROXYSQL_*` env vars), `summary` mode for status, `prefix` and `like` filters for variables, backend server and connection pool tools, query analysis, admin commands, and memory/process monitoring.
- **`mysql_security_user_privileges` Summary Mode** — Added optional `summary: boolean` parameter to return condensed privilege info (grant counts, role counts, hasAllPrivileges, hasWithGrantOption, sample global privileges) instead of verbose raw GRANT strings. Significantly reduces payload size for servers with many users.
- **Role Management Server Instructions** — Expanded Role Management documentation from 2 bullets to 7, covering privilege requirements, role lifecycle (create→grant→assign), pattern filtering, `withAdminOption`, user role admin flag display, and graceful `exists: false` response for nonexistent roles.
- **`mysql_fulltext_create` Graceful Duplicate Handling** — Tool now returns `{ success: false, reason: "Index 'name' already exists on table 'table'" }` instead of propagating raw MySQL error 1061 (ER_DUP_KEYNAME) when creating a duplicate index.
- **`mysql_fulltext_drop` Graceful Non-Existent Handling** — Tool now returns `{ success: false, reason: "Index 'name' does not exist on table 'table'" }` instead of propagating raw MySQL error 1091 (ER_CANT_DROP_FIELD_OR_KEY) when dropping a non-existent index.
- **`mysql_doc_create_collection` `ifNotExists` Parameter** — Added optional `ifNotExists: boolean` parameter (default: false) to use `CREATE TABLE IF NOT EXISTS` syntax, preventing errors when the collection already exists.
- **Document Store Server Instructions** — Expanded documentation covering `ifNotExists` parameter, collection detection heuristic (tables with `doc JSON` + `_id` fields), and `mysql_doc_find` graceful `exists: false` response for nonexistent collections.
- **Configuration Examples** — Added `MYSQL_XPORT` environment variable to ecosystem configuration examples in `.env.example`, `README.md`, and `DOCKER_README.md`. Required for `mysqlsh_import_json` which uses X Protocol (default: 33060, use 6448 with MySQL Router).
- **`mysql_import_data` Existence Check (P154)** — Tool now returns `{ exists: false, table }` gracefully when the target table does not exist, instead of throwing a raw error. Follows the same pattern used by `mysql_export_table` and `mysql_describe_table`.
- **`mysql_import_data` Duplicate Key Handling** — Tool now returns `{ success: false, error, rowsInserted }` for duplicate key violations, reporting how many rows were successfully inserted before the conflict. Previously propagated a raw MySQL error.
- **`mysql_export_table` Existence Check (P154)** — Tool now returns `{ exists: false, table: "..." }` gracefully when the table does not exist, instead of propagating a raw MySQL error. Follows the same pattern used by `mysql_table_stats` and `mysql_index_recommendation`.
- **`mysqlsh_dump_tables` Error Messaging** — Improved error handling to identify specific missing privileges (EVENT, TRIGGER) and provide actionable guidance. Now matches the clarity of `mysqlsh_dump_schemas` error messages, detecting "Writing schema metadata" errors and suggesting `all: false` as a workaround.
- **`mysql_doc_collection_info` Accurate Row Count** — Fixed tool returning stale `rowCount` from `INFORMATION_SCHEMA.TABLES.TABLE_ROWS` (InnoDB estimate) that would not reflect recent insertions or deletions. Now uses accurate `SELECT COUNT(*)` query for real-time row counts.
- **`mysql_doc_find` Nonexistent Collection Handling** — Fixed tool throwing raw SQL error for nonexistent collections. Now performs collection existence check first and returns `{ exists: false, collection, error: "Collection does not exist", documents: [], count: 0 }` for graceful error handling.
- **`mysql_security_password_validate` Component Detection** — Fixed tool returning `strength: 0` for all passwords when the `validate_password` component is not installed (instead of indicating unavailability). Now checks for component variables first and returns `{ available: false, message: "...", suggestion: "INSTALL COMPONENT..." }` when the component is missing.
- **`mysql_security_mask_data` Partial Mask Edge Case** — Fixed character duplication when `keepFirst + keepLast >= value.length` (e.g., masking "AB" with `keepFirst: 3, keepLast: 3` returned "ABAB" instead of "AB"). Now returns the original value unchanged when keep parameters cover the entire string.
- **`mysql_security_sensitive_tables` Schema Filter** — Fixed schema filter not being applied correctly when using prepared statement parameters. The `COALESCE(?, DATABASE())` pattern did not work as expected with null values. Now uses explicit WHERE clause construction based on whether schema is provided.
- **`mysql_role_grants` Nonexistent Role Handling** — Fixed tool throwing raw SQL error for nonexistent roles. Now performs role existence check first and returns `{ role, grants: [], exists: false }` instead of a cryptic "No such grant defined" error.
- **`mysql_role_grant`, `mysql_role_assign`, `mysql_role_revoke` Nonexistent Role Handling** — Fixed all three tools throwing raw SQL errors for nonexistent roles. Now performs role existence check first and returns `{ success: false, exists: false, error: "Role does not exist" }` for graceful error handling, matching the pattern used by `mysql_role_grants`.
- **Spatial GeoJSON Conversion** — Fixed `mysql_spatial_geojson`, `mysql_spatial_intersection`, `mysql_spatial_buffer`, `mysql_spatial_transform`, and `mysql_spatial_polygon` returning null GeoJSON output. MySQL 8.0+ SRID 4326 uses latitude-longitude axis order internally, conflicting with the GeoJSON standard (longitude-latitude). Added `axis-order=long-lat` option to all `ST_GeomFromText` calls to ensure correct coordinate conversion.
- **Spatial GeoJSON Output Axis Order (P147)** — Fixed `mysql_spatial_buffer` and `mysql_spatial_intersection` returning GeoJSON coordinates in wrong order (`[lat, lon]` instead of `[lon, lat]`). The `fixGeoJsonAxisOrder()` helper was incorrectly swapping coordinates that MySQL's `ST_AsGeoJSON()` already outputs in GeoJSON-compliant lon-lat order. Removed the incorrect swap to restore proper coordinate output.
- **`mysql_spatial_create_index` Nullable Column Validation** — Tool now validates that the target column is NOT NULL before attempting to create a SPATIAL index. Previously failed with a cryptic MySQL error. Now provides a clear error message with an ALTER TABLE suggestion.
- **JSON Tools Auto-Quoting** — JSON tools (`mysql_json_set`, `mysql_json_insert`, `mysql_json_replace`, `mysql_json_contains`, `mysql_json_array_append`, `mysql_json_update`) now automatically wrap bare strings as valid JSON. Previously, passing `value: "green"` would fail with "Invalid JSON value" requiring escaped quotes like `value: "\"green\""`. Now bare strings are auto-converted, making the MCP interface more user-friendly.
- **`mysql_json_validate` Error Handling** — Fixed tool throwing errors on invalid JSON input instead of returning a structured response. Now gracefully returns `{ valid: false, error: "..." }` for malformed input.
- **`mysql_json_get` Response Consistency** — Fixed tool returning stringified JSON instead of parsed objects. Now aligns with `mysql_json_extract` by returning parsed JSON values for objects and arrays.
- **`mysql_query_rewrite` OR Detection** — Fixed tool incorrectly suggesting OR optimization for queries that don't contain OR in the WHERE clause (e.g., suggesting it for `ORDER BY` containing "OR"). Now accurately checks only the WHERE clause for OR conditions.
- **`mysql_kill_query` Error Handling** — Fixed tool throwing raw MySQL error for non-existent process IDs. Now returns structured response `{ success: false, error: "Process ID X not found" }` instead of throwing "Unknown thread id" exception.
- **`mysql_export_table` Datetime Formatting** — Fixed SQL and CSV exports wrapping datetime values in extra JSON-style quotes (e.g., `'"2026-02-06T01:21:24.000Z"'`). Now exports datetime as MySQL-compatible format (`'2026-02-06 01:21:24'`) that can be directly restored.
- **`mysql_import_data` Error Messages** — Improved error message when importing to a non-existent table. Now returns descriptive guidance: `"Import failed: Table 'X' does not exist. Create the table first before importing data."` instead of a raw MySQL error.
- **`mysql_sys_io_summary` File Type** — Fixed tool failing with "Unknown column 'total_write'" error when using `type: file`. The `sys.io_global_by_file_by_bytes` view column is `total_written`, not `total_write`.
- **`mysql_stats_distribution` Bucket Boundaries** — Fixed malformed `rangeStart`/`rangeEnd` values in histogram buckets (e.g., `"20.001.73"` instead of `21.73`). MySQL returns DECIMAL columns and FLOOR() results as strings, causing string concatenation instead of arithmetic. Now explicitly converts min, max, and bucket numbers to numbers.
- **`mysql_spatial_contains` / `mysql_spatial_within` WKT Parsing** — Fixed both tools returning empty results when geometries should match. The tools were not applying `axis-order=long-lat` option to `ST_GeomFromText` calls, causing coordinate mismatch with SRID 4326 geometry columns. Also updated `test-seed.sql` to use `axis-order=long-lat` for proper test data storage.
- **Router Tools Graceful Error Handling** — All 9 `mysql_router_*` tools now return `{ available: false, reason: "..." }` with descriptive error messages when the Router REST API is unreachable, instead of throwing raw errors. Improved error messages for common issues: connection refused, timeout, TLS certificate errors.
- **`mysqlsh_export_table` Format Correction** — Removed misleading `json` format option from the export_table tool schema. MySQL Shell's `util.exportTable()` only supports delimited formats (CSV and TSV), not JSON output. The format parameter now correctly accepts only `csv` or `tsv`.
- **`mysqlsh_run_script` SQL Comment Handling** — Fixed SQL scripts with comments (e.g., `-- comment`) or multi-statement syntax failing with "option -e requires an argument" error. SQL scripts are now written to a temp file and executed via `--file` flag instead of `-e`, properly supporting all SQL syntax including comments.

### Changed

- **Partitioning Tools Server Instructions** — Updated documentation to describe P154 existence check behavior, structured error handling for write tools, and MAXVALUE conflict guidance.
- **`mysql_spatial_buffer` Segments Parameter** — Added optional `segments` parameter (default: 8, MySQL default: 32) controlling the number of segments per quarter-circle in the buffer polygon approximation. Uses MySQL's `ST_Buffer_Strategy('point_circle', N)` for Cartesian geometries (SRID 0). Geographic SRIDs (e.g., 4326) use MySQL's internal geographic buffer algorithm which does not support custom segment counts; the `segments` parameter is ignored for geographic SRIDs. Response now includes `segmentsApplied: true/false` to indicate whether the parameter was effective.
- **Replication Tools Server Instructions** — Updated `mysql_binlog_events` documentation to note that it defaults to the oldest available binlog file when `logFile` is omitted, and that it returns `{ success: false, error }` for nonexistent binlog files.
- **Shell Tools Server Instructions** — Corrected `mysqlsh_import_json` documentation (supports multi-line JSON objects, not just NDJSON). Added `mysqlsh_check_upgrade` error behavior documentation. Added error handling notes for export and dump tools.
- **`mysqlsh_import_json` Tool Description** — Corrected description to accurately state support for both NDJSON and multi-line JSON objects (not JSON arrays).
- **X Protocol Documentation** — Documented `MYSQL_XPORT` environment variable in README env var example and ecosystem prerequisites. Added X Protocol requirements to test database plan for shell and docstore tool groups.
- **Schema Tools Server Instructions** — Expanded documentation to describe `mysql_create_schema`/`mysql_drop_schema`/`mysql_create_view` graceful error responses, `mysql_list_constraints` P154 behavior with `type` filter parameter, `mysql_create_view` parameters (`orReplace`, `algorithm`, `checkOption`), and `schema` parameter on all introspection tools.
- **Events Tools Server Instructions** — Expanded documentation to describe graceful error handling, `ifNotExists` support for `mysql_event_create`, P154 behavior for `mysql_event_status`, and `onCompletion` alter capability for `mysql_event_alter`.
- **`mysql_sys_schema_stats` Default Limit** — Reduced default `limit` from 50 to 20. The previous default produced ~34KB payloads (50 rows × 3 arrays). The new default keeps responses manageable while still providing useful coverage.
- **Sys Schema Tools Server Instructions** — Expanded documentation with default `limit` values, `mysql_sys_schema_stats` 3-array output description (`tableStatistics`, `indexStatistics`, `autoIncrementStatus`), `schema` filter parameter, `mysql_sys_memory_summary` dual-array structure, and `by_instance` per-instance granularity note.
- **`proxysql_status` Response Parity** — Full (non-summary) response now includes `summary: false` and `totalVarsAvailable` fields, matching the summary response structure for consistent consumption.
- **InnoDB Cluster Topology Server Instructions** — Updated `mysql_cluster_topology` description to accurately reflect that it returns both a structured `topology` JSON object (with `primary`, `secondaries`, `recovering`, `offline` arrays) and a `visualization` string, not just an ASCII visualization.
- **ProxySQL Tools Server Instructions** — Updated documentation to describe `proxysql_status` response parity, `proxysql_global_variables` `limit` parameter, and `proxysql_runtime_status` full admin variable listing.
- **Shell Tools Server Instructions** — Updated `mysqlsh_export_table` documentation to correctly list only CSV and TSV formats. Added Group Replication note for `mysqlsh_import_table`: target tables must have a PRIMARY KEY when importing to InnoDB Cluster environments.
- **`mysqlsh_import_table` Parameter Clarity** — Improved `columns` parameter description to clarify positional mapping behavior (Nth field → Nth column). Updated `fieldsTerminatedBy` description to emphasize CSV files require explicit delimiter setting (auto-detect not supported).
- **`mysqlsh_import_json` NDJSON Requirement** — Updated tool description and server instructions to clarify file must be NDJSON format (one JSON object per line), not JSON array format.
- **Test Database Reset Script** — Added `-Cluster` switch to `reset-database.ps1` to support seeding both standalone MySQL (`mysql-final`) and InnoDB Cluster (`mysql-node1`) environments. Documentation examples now consistently use `testdb` database.
- **Fulltext Tools Minimal Payload (P137)** — All 4 fulltext search tools (`mysql_fulltext_search`, `mysql_fulltext_boolean`, `mysql_fulltext_expand`) now return only `id`, searched column(s), and `relevance` instead of all columns. This significantly reduces response payload size.
- **Fulltext Server Instructions** — Added comprehensive fulltext section documenting index management, search modes, boolean operators, query expansion, and minimal output format.
- **Text Tools Minimal Payload** — All 6 text tools (`mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert`) now return only `id`, target column(s), and computed result instead of all columns. This significantly reduces response payload size.
- **Server Instructions** — Added Text Tools section documenting LIKE patterns, regex syntax, SOUNDEX usage, WHERE clause support, and minimal output format.
- **Performance Tools Server Instructions** — Added Performance section documenting EXPLAIN formats, EXPLAIN ANALYZE usage, performance_schema requirements, index_usage filtering, and buffer pool diagnostics.
- **Optimization Tools Server Instructions** — Added Optimization section documenting index recommendations, query rewriting, FORCE INDEX hints, and optimizer trace (including the new `summary` mode).
- **`mysql_optimizer_trace` Summary Mode** — Added optional `summary: boolean` parameter to return only key optimization decisions (index selections, access paths, estimated costs) instead of the full verbose trace. Reduces payload from ~10KB to ~500B for typical queries.
- **Admin Tools Server Instructions** — Added Admin Tools section documenting optimize, analyze, check, repair, flush, and kill operations.
- **`mysql_index_usage` Database Filter** — Tool now filters to current database by default, preventing massive payloads (~45KB → ~1KB) from including all MySQL internal indexes with zero counts.
- **Node.js 24 LTS Baseline** — Upgraded from Node 20 to Node 24 (current LTS) across Dockerfile, CI workflows, and package.json engines for high-fidelity production security.
- **Docker Workflow: Explicit CodeQL Gating** — Docker image publishing now depends on both `quality-gate` and `codeql` jobs, ensuring security regressions block deployments.
- **Dependabot Grouping** — Added dependency groups for `vitest` (vitest, @vitest/_), `eslint` (eslint, @eslint/_, typescript-eslint, globals), and `types` (@types/\*) to prevent peer dependency fragmentation.
- **`mysql_innodb_status` Summary Mode** — Added optional `summary: boolean` parameter to return only key metrics (buffer pool, row operations, transactions, log status) instead of raw InnoDB monitor output. Reduces payload from ~5KB to ~200B.
- **`mysql_replication_status` Structured Response** — Tool now returns `{ configured: false, message: "..." }` when replication is not set up instead of an empty object, making it easier to programmatically check replication status.
- **`mysql_slave_status` Structured Response** — Tool now returns `{ configured: false, message: "..." }` when server is not a replica instead of an empty object, aligning with other replication tools.
- **Replication Tools Server Instructions** — Added Replication section documenting master status, slave status, binlog events, GTID status, and replication lag tools.
- **Monitoring Tools Server Instructions** — Added Monitoring section documenting processlist, status/variables filtering, server health, InnoDB status summary mode, replication status behavior, and pool stats.
- **`mysql_describe_table` Existence Check** — Tool now returns `{ exists: false, table: "...", message: "..." }` gracefully when the table does not exist, instead of returning an empty columns array. Simplifies error handling for agents.
- **`mysql_get_indexes` Existence Check** — Tool now returns `{ exists: false, table: "...", indexes: [], message: "..." }` gracefully when the table does not exist, matching the pattern used by `mysql_describe_table`.
- **`mysql_create_table` Boolean Default Conversion** — Tool now auto-converts boolean `default: true` to `1` and `default: false` to `0` for MySQL compatibility. Previously, boolean defaults caused "Invalid default value" errors.
- **`mysql_index_recommendation` Existence Check (P154)** — Tool now returns `{ exists: false, table }` gracefully when the table does not exist, instead of returning empty arrays. Follows the same pattern used by `mysql_describe_table` and `mysql_get_indexes`.

### Added

- **`mysql_export_table` Limit Parameter** — New optional `limit` parameter to control the number of rows exported, preventing oversized payloads for large tables.
- **`mysql_fulltext_drop`** — New tool for dropping FULLTEXT indexes, providing symmetry with `mysql_fulltext_create`.
- **`proxysql_global_variables` Limit Parameter** — Added optional `limit` parameter (default: 200) to cap the number of returned variables, preventing oversized payloads when querying all ProxySQL global variables without prefix or like filters.
- **`proxysql_status` Summary Mode (P141)** — Added optional `summary: boolean` parameter to return only key metrics (uptime, queries, connections, buffer sizes) instead of all 77 status variables. Reduces payload from ~4KB to ~500B.
- **`proxysql_global_variables` Like Filter** — Added optional `like: string` parameter for LIKE pattern matching on variable names (e.g., `like: "%connection%"`). Can be combined with the existing `prefix` filter for targeted queries.
- **MySQL Shell Tools Server Instructions** — Added comprehensive Shell Tools section documenting prerequisites, version checking, upgrade compatibility analysis, script execution (JS/Python/SQL), export/import utilities, dump/load operations, and privilege requirements.
- **`mysql_cluster_status` Summary Mode** — Added optional `summary: boolean` parameter to return only essential cluster metadata (cluster name, ID, type, instance/router counts) instead of full Router configuration schemas. Reduces payload from ~21KB to ~500B.
- **`mysql_cluster_router_status` Summary Mode** — Added optional `summary: boolean` parameter to return only essential router info (ID, name, address, version, last check-in, ports, local cluster) instead of full configuration blobs. Reduces payload from ~12KB to ~300B per router.
- **InnoDB Cluster Tools Server Instructions** — Added comprehensive InnoDB Cluster section documenting prerequisites, cluster status, instance listing, topology visualization, router status from metadata, and switchover analysis.
- **Core Tools Server Instructions** — Added Core Tools section documenting prepared statement syntax (`mysql_read_query`, `mysql_write_query`), DDL support via text protocol, boolean default conversion, graceful `exists: false` pattern, index creation options, and qualified table name support.
- **Transaction Tools Server Instructions** — Expanded transaction documentation from 4 generic lines to comprehensive section covering interactive transaction workflow (`transactionId` in `mysql_read_query`/`mysql_write_query`), atomic execution via `mysql_transaction_execute`, savepoint tools, and isolation level options.
- **`mysql_json_diff` Field-Level Comparison** — Enhanced tool to compute value-level differences for shared keys, returning `addedKeys`, `removedKeys`, and `differences` arrays with `{ path, value1, value2 }` entries. Previously only reported key-level metadata (identical, contains, length).
- **`mysql_json_insert` Changed Indicator** — Tool now returns `{ changed: true/false }` to indicate whether the value was actually inserted. When the path already exists, returns `changed: false` with an explanatory note instead of a misleading `rowsAffected: 1`.
- **Text Tools `where` Support** — Added optional `where` parameter to `mysql_regexp_match`, `mysql_like_search`, and `mysql_soundex` for additional row filtering. The `where` clause is combined with the pattern match using AND. All 6 text tools now consistently support `where` filtering.
- **Text Tools `count` Response** — Added `count` field to `mysql_substring`, `mysql_concat`, and `mysql_collation_convert` responses for consistency. All 6 text tools now return `{ rows, count }`.
- **`mysql_concat` `includeSourceColumns` Option** — Added optional `includeSourceColumns` parameter (default: `true`). Set to `false` for minimal payload containing only `id` and the concatenated result, omitting individual source columns.
- **Fulltext Search `maxLength` Parameter** — Added optional `maxLength` parameter to `mysql_fulltext_search`, `mysql_fulltext_boolean`, and `mysql_fulltext_expand`. Truncates TEXT column values exceeding `maxLength` characters with `...` appended, reducing payload size for tables with large text content.
- **Fulltext Tools Server Instructions** — Updated documentation with column-matching requirement (MATCH columns must exactly match FULLTEXT index), `maxLength` parameter usage, and graceful error handling for create/drop operations.
- **`mysql_index_usage` Limit Parameter** — Added optional `limit` parameter (default: 50) to cap the number of returned index usage rows, preventing excessively large payloads in databases with many indexes.
- **Performance Tools Server Instructions** — Updated documentation with `mysql_table_stats` existence check pattern, `mysql_thread_stats` description, `mysql_explain_analyze` TREE-only constraint, and `mysql_index_usage` limit parameter.

### Dependencies

- Bumped `@modelcontextprotocol/sdk` from `^1.25.2` to `^1.26.0`
- Bumped `@types/node` from `^25.0.8` to `^25.2.1`
- Bumped `@vitest/coverage-v8` from `^4.0.17` to `^4.0.18`
- Bumped `commander` from `^14.0.2` to `^14.0.3`
- Bumped `cors` from `^2.8.5` to `^2.8.6`
- Bumped `globals` from `^17.0.0` to `^17.3.0`
- Bumped `mysql2` from `^3.16.0` to `^3.16.3`
- Bumped `typescript-eslint` from `^8.53.0` to `^8.54.0`
- Bumped `vitest` from `^4.0.17` to `^4.0.18`
- Bumped `zod` from `^4.3.5` to `^4.3.6`

### Security

- **CVE Fix: hono JWT Algorithm Confusion** — Updated transitive dependency `hono` to 4.11.4 to fix GHSA-f67f-6cw9-8mq4 (JWT algorithm confusion allowing token forgery and auth bypass when JWK lacks "alg" field).

## [2.1.0] - 2026-01-03

### Fixed

- **Document Store Filter Tools** — Fixed `mysql_doc_modify` and `mysql_doc_remove` failing with "Invalid JSON path expression" error. These tools previously only supported JSON path existence checks but users expected value-based filtering. Added `parseDocFilter()` function supporting three filter formats:
  - **By \_id**: Direct 32-char hex string (e.g., `bbc83181703d43e68ffad119c4bbbfde`)
  - **By field=value**: Simple equality (e.g., `name=Alice`, `age=30`)
  - **By JSON path existence**: Path starting with `$` (e.g., `$.address`)
  - Now uses parameterized queries for SQL injection protection.
- **Group Replication Tools MySQL 8.0 Compatibility** — Fixed `mysql_gr_members` and `mysql_gr_transactions` failing with "Unknown column" errors on MySQL 8.0.44. Removed non-existent columns `COUNT_TRANSACTIONS_VALIDATING` and `COUNT_TRANSACTIONS_CERTIFIED` from queries. These columns don't exist in MySQL 8.0's `performance_schema.replication_group_member_stats` table. Tools now use only the available columns documented in MySQL 8.0 (kept `COUNT_TRANSACTIONS_ROWS_VALIDATING` which does exist).
- **InnoDB Cluster Status Tool** — Fixed `mysql_cluster_status` failing with "Unable to query cluster metadata" due to hardcoded column names (`default_replicaset`) that don't exist in all InnoDB Cluster metadata schema versions. Changed to `SELECT *` for compatibility across MySQL versions. Also added error details to response for easier debugging.
- **Spatial Coordinate Order (Final Fix)** — Fixed `mysql_spatial_point`, `mysql_spatial_distance`, and `mysql_spatial_distance_sphere` to correctly accept longitude-latitude parameter order by using MySQL's `axis-order=long-lat` option. Previous fix in v2.0.0 swapped the coordinates internally but this was confusing since parameter names didn't match their usage. Now tools accept natural `{ longitude: -122.4194, latitude: 37.7749 }` order and MySQL handles the EPSG 4326 axis order conversion automatically. This resolves the long-standing coordinate confusion issue.
- **Router TLS with Node.js fetch** — Fixed `mysql_router_*` tools failing with "fetch failed" when `MYSQL_ROUTER_INSECURE=true`. Node.js native `fetch()` uses undici which doesn't support `https.Agent` for TLS options. Replaced with native `https.request()` module for proper self-signed certificate handling.
- **Partitioning Tools** — Fixed `mysql_reorganize_partition` to support both RANGE and LIST partition types (previously hardcoded to RANGE only). Added required `partitionType` parameter to schema.
- **MySQL Shell Tools Error Handling** — Improved error detection in `execShellJS()` to properly catch errors from stderr (e.g., `local_infile disabled`, privilege errors, fatal dump errors) instead of silently returning raw output.
- **MySQL Shell Export Table** — Removed unsupported `columns` option from `mysqlsh_export_table` (not supported by `util.exportTable()` in MySQL Shell 9.x).

### Removed

- **Jupyter Quickstart Notebook** — Removed `examples/notebooks/quickstart.ipynb` and the `examples/` directory. The notebook had kernel instability issues on Windows (ZMQ socket errors causing kernel restarts during MCP subprocess communication). Usage instructions are now provided to AI agents automatically via the MCP protocol's `instructions` capability.

### Changed

- **Server Instructions** — Added document store filter syntax documentation with examples for `mysql_doc_modify` and `mysql_doc_remove`. Added spatial tools section documenting coordinate order behavior and MySQL 8.0+ EPSG standard handling with `axis-order=long-lat` option.

### Added

- **`mysqlsh_import_table` / `mysqlsh_load_dump` — `updateServerSettings` parameter** — New boolean option to automatically enable `local_infile` on the server before import/load operations. Requires SUPER or SYSTEM_VARIABLES_ADMIN privilege.
- **`mysqlsh_dump_schemas` — `ddlOnly` parameter** — New boolean option to dump only DDL (schema structure) without events, triggers, or routines. Useful when the user lacks EVENT or TRIGGER privileges.
- **`mysqlsh_dump_tables` — `all` parameter** — New boolean option (default: false) to control whether triggers are included in the dump. Set to `false` to skip triggers when lacking TRIGGER privilege.

### Changed

- **Partitioning Schema Descriptions** — Improved `value` parameter descriptions in `AddPartitionSchema` and `ReorganizePartitionSchema` to clarify that only boundary values should be provided (e.g., `"2024"`), not full SQL clauses (e.g., `"LESS THAN (2024)"`).
- **Server Instructions** — Added partitioning tools section with usage guidance and examples to prevent common parameter format errors.

### Added

- **Server Instructions** — Usage instructions are now automatically provided to AI agents via the MCP protocol's `instructions` capability during server initialization. See [`src/constants/ServerInstructions.ts`](src/constants/ServerInstructions.ts).

### Testing

- **Branch Coverage Improvements** — Added 112 new tests targeting uncovered branches across multiple modules:
  - **CLI** — Tests for `canSkipMySQLConnection()` covering router-only, proxysql-only, shell-only, ecosystem shortcut, shortcuts requiring MySQL, exclusion-only filters, and placeholder adapter registration
  - **Shell Types** — 100% branch coverage for `booleanCoerce` preprocessor across all shell input schemas
  - **Data Transfer** — Tests for `updateServerSettings`, `local_infile` error handling, X Protocol access denied, and JSON parsing edge cases
  - **Backup Tools** — Tests for `ddlOnly` mode, privilege errors (EVENT, TRIGGER), and Fatal dump error handling
  - **Restore Tools** — Tests for `updateServerSettings` and `local_infile` error branches
  - **JSON Enhanced** — Tests for merge with object results, diff key parsing, where clauses, type mappings (DOUBLE, BOOLEAN, UNKNOWN), and cardinality filtering
  - **InnoDB Cluster** — New test file covering fallback to GR status, error handling, and router metadata failures
- **Overall Coverage** — Branch coverage improved from ~83% to ~86%, with 1590 tests passing across 101 test files

### Performance

- **Native MCP Logging** — Upgraded to MCP SDK v1.25.1 which provides native logging capabilities via `server.sendLoggingMessage()`, eliminating the need for custom stderr-based logging infrastructure
- **Parallelized Health Queries** — Health resource now executes status and max_connections queries concurrently using `Promise.all()`
- **Batched Index Queries** — `SchemaManager.getSchema()` now fetches all indexes in a single query
  - Eliminates N+1 query pattern (e.g., 101 queries → 1 query for 100 tables)
- **Metadata Cache with TTL** — Added configurable TTL-based cache to `SchemaManager` for expensive metadata queries
  - Default 30s TTL, configurable via `METADATA_CACHE_TTL_MS` environment variable
  - `clearCache()` method for invalidation after schema changes
- **Performance Benchmark Tests** — Added `src/__tests__/performance.test.ts` with 8 tests covering:
  - Tool definition caching validation
  - Metadata cache TTL expiration behavior
  - Parallel vs sequential execution patterns
  - N+1 to batch query improvement verification

### Changed

- **Logger Test Updates** — Updated logger tests to match RFC 5424 severity levels:
  - `warn` → `warning` level naming
  - Updated format assertions to match `[LEVEL]` structured format (e.g., `[WARNING]`, `[DEBUG]`)

### Added

- **SchemaManager Cache Tests** — Added tests for cache TTL expiration, cache invalidation, and schema-qualified table name handling in `getTableIndexes()`
- **Logger Coverage Improvements** — Added 30+ tests covering:
  - `setLoggerName()`, `getLoggerName()`, `setDefaultModule()` configuration methods
  - `notice()`, `critical()`, `alert()`, `emergency()` log levels
  - `forModule()` module-scoped logger with all severity levels
  - Code formatting in log output
- **CI/CD Quality Gate** - Added `quality-gate` job to `docker-publish.yml` workflow that runs lint, typecheck, and all 1478 unit tests before allowing Docker image builds. Deployments now require all tests to pass.
- Added comprehensive test coverage for `MySQLAdapter`, `TokenValidator`, and `comparative` stats tools.
- Added unit tests for security audit tool fallbacks and filtering logic.
- Added meaningful tests for `locks` resource to handle undefined/partial query results.
- Added test coverage for `indexes` resource edge cases (undefined rows).
- Added test coverage for `events` resource edge cases.
- Added meaningful test coverage for `constraints.ts` (schema-qualified table parsing), `router.ts` (auth headers, TLS handling), and `utilities.ts` (option handling branches).
- Added comprehensive tests for `security` tool edge cases (encryption status, SSL status).
- Added tests for `views` schema tool validation and check options.
- **Transaction-Aware Queries** - Added optional `transactionId` parameter to `mysql_read_query` and `mysql_write_query` tools, enabling interactive queries within active transactions.
- **MCP Enhanced Logging** — Full MCP protocol-compliant structured logging
  - RFC 5424 severity levels: debug, info, notice, warning, error, critical, alert, emergency
  - Module-prefixed error codes (e.g., `DB_CONNECT_FAILED`, `AUTH_TOKEN_INVALID`)
  - Structured log format: `[timestamp] [LEVEL] [MODULE] [CODE] message {context}`
  - Module-scoped loggers via `logger.forModule()` and `logger.child()`
  - Sensitive data redaction for OAuth 2.1 configuration fields
  - Stack trace inclusion for error-level logs with sanitization
  - Log injection prevention via control character sanitization
- **All 191 tools and 26 resources fully tested** - Comprehensive testing completed including InnoDB Cluster (3-node Group Replication), MySQL Router REST API, ProxySQL admin interface, and MySQL Shell utilities.

### Security

- **CodeQL Remediation** - Fixed 4 security vulnerabilities identified by CodeQL analysis:
  - Removed sensitive OAuth configuration logging (issuer/audience) from startup output
  - Added explicit warning when Router API TLS certificate validation is bypassed
  - Fixed incomplete string escaping in quick query prompt (now escapes backslashes before quotes)
  - **Router TLS Handling** - Replaced global `NODE_TLS_REJECT_UNAUTHORIZED` environment variable manipulation with a targeted HTTPS `Agent` for insecure mode. This eliminates the CodeQL "disabling certificate validation" alert while still supporting self-signed certificates for development/testing via the `MYSQL_ROUTER_INSECURE=true` option.

### Fixed

- Removed unused imports and variables from 9 test files to improve code quality (CodeQL alerts #8-18)
- **ProxySQL Runtime Status** - Fixed `proxysql_runtime_status` failing with SQL syntax error "near 'version': syntax error". The tool was using `@@admin-version` syntax which is not supported by ProxySQL's SQLite-based admin interface. Now correctly queries `global_variables` table.
- **CRITICAL: MCP stdio Transport Crash** - Removed debug `console.error` in `MySQLAdapter.executeOnConnection()` that was writing to stderr and corrupting the MCP stdio JSON-RPC message stream, causing the server to crash when any tool was called. This was introduced during the DDL support improvements.
- **DDL Support** - Fixed `mysql_write_query` failing on DDL statements (like `CREATE TABLE`, `CREATE USER`) by implementing automatic fallback to the text protocol when the specific "not supported in prepared statement protocol" error is encountered.
- **JSON Validation** - Enforced strict JSON validation for `mysql_json_*` tools. String values must now be properly quoted (e.g., `'"value"'`) to be stored as strings. Unquoted strings that are invalid JSON will now throw a descriptive error instead of being accepted and potentially mishandled.
- **JSON & Text Tools Qualified Table Names** - Fixed all 17 JSON tools and 6 text processing tools to correctly handle schema-qualified table names (e.g., `schema.table`). Previously these tools would reject qualified names with "Invalid table name" errors. Now uses `validateQualifiedIdentifier()` and `escapeQualifiedTable()` for proper handling.
- Fixed potential issue in `indexes` resource where undefined query results could lead to undefined properties instead of empty arrays.
- Fixed SQL syntax errors in `mysql_stats_descriptive` tool: escaped `range` reserved keyword and fixed invalid LIMIT/OFFSET syntax in median calculation.
- Fixed `mysql_json_index_suggest` compatibility with `ONLY_FULL_GROUP_BY` and corrected sampling logic.
- Fixed `mysql_spatial_polygon` schema validation error by replacing `z.tuple` with `z.array` to generate compatible JSON schema.
- **Spatial SRID Fix** - Fixed `mysql_spatial_contains` and `mysql_spatial_within` failing on columns with SRID 4326 due to SRID mismatch. Both tools now accept an optional `srid` parameter (default: 4326) and wrap input geometries with `ST_SRID()` to match the column's SRID.
- **Spatial Coordinate Order** - Fixed `mysql_spatial_point`, `mysql_spatial_distance`, and `mysql_spatial_distance_sphere` creating POINT geometries with incorrect coordinate order for SRID 4326. MySQL 8.0+ follows the EPSG standard axis order (latitude, longitude) for SRID 4326, but the tools were generating `POINT(longitude latitude)`. Now correctly generates `POINT(latitude longitude)`. Updated `mysql_setup_spatial` prompt documentation accordingly.
- Improved branch coverage across multiple modules.
- Fixed `mysql_sys_io_summary` failing on MySQL 9.4 due to schema changes in `sys.io_global_by_wait_by_latency` (replaced `wait_class` with `event_name`).
- **Table Name Handling** - Fixed `mysql_create_table`, `mysql_drop_table`, `mysql_create_index`, `mysql_describe_table`, and `mysql_get_indexes` to correctly handle fully qualified table names (e.g., `schema.table`). Added intelligent parsing and proper backtick escaping for schema prefixes.
- **Role Grant Handling** - Fixed `mysql_role_grant` to correctly handle schema-qualified table names (e.g., `schema.table`) in the `table` parameter, preventing syntax errors when specifying target tables.
- **Fixed Role Grant** - Fixed `mysql_role_grant` tool logic to correctly handle wildcard privileges (`*`) versus specific table grants, resolving syntax errors when granting privileges to specific tables.
- **Schema-Qualified CREATE TABLE** - Fixed `mysql_create_table` failing with "No database selected" when using schema-qualified names (e.g., `testdb.table`). Now automatically issues `USE schema` before CREATE TABLE when a qualified name is detected.
- **View Management** - Fixed `mysql_create_view` to correctly handle schema-qualified view names (e.g. `schema.view`) and improved validation error messages.
- **Router TLS Self-Signed Certificates** - Fixed `mysql_router_*` tools failing with "fetch failed" when connecting to Router REST API using HTTPS with self-signed certificates. The `MYSQL_ROUTER_INSECURE=true` environment variable now properly bypasses certificate verification using a targeted HTTPS agent with `rejectUnauthorized: false`.

### Coverage

- Branch coverage: ~83.87%
- Statement coverage: ~97.34%

## [2.0.0] - 2025-12-16

### Major Release Highlights

**mysql-mcp v2.0.0** represents a transformative update with **85 new tools** (106 → 191 tools), comprehensive security enhancements, HTTP/SSE streaming transport, and extensive refactoring for production-grade stability.

> **New:** Simplified tool filtering syntax is now supported! Use `"+starter"` or `"starter"` (whitelist mode) to automatically disable all other tools and enable only what you need. Default toolset is now `starter` (38 tools) if no filter is provided.

- **Modular Refactoring and Test Improvements** - Significantly improved code quality and test modularity:
  - **Refactored CLI** - Extracted argument parsing to `src/cli/args.ts` and achieved 91% coverage for `src/cli.ts` (main entry point) including signal handling and error scenarios.
  - **Modular Tool Structure** - Refactored monolithic tool files into clean, maintainable directories for `security` and `cluster` tools.
  - **Enhanced Test Coverage** - Added comprehensive tests for:
    - Service availability: `security` (SSL/TLS status, password validation, encryption status)
    - Cluster management: `group-replication` (status, flow control, members)
    - Text processing: `mysql_substring`, `mysql_concat` (WHERE clause validation)
    - CLI operations: Graceful shutdown, OAuth logging, connection error handling
  - **Bug Fixes**
    - Fixed `mysql_list_tables` failing to filter by database name; it now correctly passes the `database` parameter to the schema manager.
    - Fixed `ExitError` handling in CLI tests and improved mock resilience.

### Security

- **Input Validation Module** - Added centralized `src/utils/validators.ts` with:
  - `validateIdentifier()` - Validates SQL identifiers (table, column, schema names) against injection
  - `validateWhereClause()` - Detects dangerous SQL patterns (stacked queries, UNION attacks, timing attacks)
  - `escapeIdentifier()` and `escapeLikePattern()` - Safe escaping utilities
- **HTTP Security Headers** - Added security headers to HTTP transport:
  - `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
  - `X-Frame-Options: DENY` - Prevents clickjacking
  - `X-XSS-Protection: 1; mode=block` - Enables XSS filtering
  - `Content-Security-Policy: default-src 'none'` - Restrictive CSP for API
  - `Cache-Control: no-store` - Prevents caching of API responses
- **Log Sanitization** - Replaced regex-based sanitization in `logger.ts` with manual character validation to prevent ReDoS and allow safe control characters (newlines, tabs).
- **SQL Injection Prevention** - Added input validation to tool handlers:
  - `backup.ts` - Table name and WHERE clause validation in export/import tools
  - `json/core.ts` - Table, column, and WHERE validation in all 8 JSON tools
- **Security Test Suite** - Added comprehensive security tests:
  - `security_injection.test.ts` - 14 tests for SQL injection prevention
  - `security_integration.test.ts` - 11 tests for validation flow and error security
  - `TokenValidator.test.ts` - 5 new OAuth edge case tests (signature, nbf, expiry)
  - `http.test.ts` - 6 tests for security header verification

### Changed

- **Refactoring** - Removed deprecated `SSEServerTransport` usage in favor of `StreamableHTTPServerTransport` from `@modelcontextprotocol/sdk`.
- **Code Quality** - Removed all `eslint-disable` directives across the codebase, ensuring strict type safety and linting compliance.
- **Test Coverage** - Improved coverage for `http.ts`, `logger.ts`, and `validators.ts` with meaningful test cases.

### Added

- **Performance Test Suite** - Added `src/__tests__/perf.test.ts` with 11 timing-based tests for regression protection:
  - Tool definition caching validation for `MySQLAdapter.getToolDefinitions()`
  - O(1) lookup verification for `getToolGroup()` (Map vs linear search)
  - Caching validation for `getAllToolNames()` and `parseToolFilter()`
  - Filter performance tests for complex filter chains (-base,-ecosystem,+starter)

### Changed

- **Code Organization - Modular Refactoring** - Improved code maintainability by refactoring large monolithic tool files (500+ lines) into focused, modular directory structures:
  - Phase 1 (Initial Refactoring):
    - `tools/spatial/` - Split 565-line file into 4 modules: `setup.ts`, `geometry.ts`, `queries.ts`, `operations.ts`
    - `tools/admin/` - Split 627-line file into 3 modules: `maintenance.ts`, `monitoring.ts`, `backup.ts`
    - `tools/sysschema/` - Split 583-line file into 3 modules: `activity.ts`, `performance.ts`, `resources.ts`
  - Phase 2 (Consistency Refactoring):
    - `tools/performance/` - Split 491-line file into 2 modules: `analysis.ts`, `optimization.ts`
    - `tools/text/` - Split 315-line file into 2 modules: `processing.ts`, `fulltext.ts`
    - Separated `replication.ts` and `partitioning.ts` into distinct files (were mixed in one 353-line file)
  - All modules export through central `index.ts` for backward compatibility
  - Zero breaking changes - all tool functionality preserved and verified via test suite (1175 tests passing)
  - Removed all eslint-disable directives and fixed type safety issues
  - **Modular Refactoring Phase 4**:
    - Extracted CLI argument parsing logic to `src/cli/args.ts`
    - Moved MySQL schema operations to `src/adapters/mysql/SchemaManager.ts`

- **Code Organization - Test Suite Modularity** - Refactored large test files into focused, modular test suites to improve maintainability and parallelism:
  - Split `admin.test.ts` (626 lines) into `admin.test.ts` (admin tools), `monitoring.test.ts` (monitoring tools), and `backup.test.ts` (backup tools).
  - Split `json.test.ts` (729 lines) and `json_handler.test.ts` (141 lines) into `json_core.test.ts` (8 core tools), `json_helpers.test.ts` (4 helper tools), and `json_enhanced.test.ts` (5 enhanced tools).
  - Verified all 1489 tests pass with strict type safety enabled.

- **Performance Optimizations** - Implemented caching and algorithmic improvements for faster server startup and tool lookups:
  - **Tool Definition Caching** - `MySQLAdapter.getToolDefinitions()` now caches all 191 tool definitions after first call, eliminating 20+ factory function calls on subsequent `tools/list` requests
  - **Reverse Lookup Map** - `getToolGroup()` now uses O(1) Map lookup instead of O(n×m) linear search through 24 groups
  - **Cached Tool Names** - `getAllToolNames()` caches the 191-tool array after first computation
  - Added `clearToolFilterCaches()` export for testing purposes

### Fixed

- **Test Integrity** - Resolved false coverage reports by refactoring `spatial` tests to target actual modular files (`tools/spatial/index.ts`) instead of legacy code.
- **Server Testing** - Added missing test coverage for `McpServer` HTTP/SSE transport startup, OAuth configuration, and error handling.
- **Legacy Cleanup** - Removed unused legacy `spatial.ts` file.
- **Shell Tools Security** - Fixed an injection vulnerability in `mysqlsh_import_table` where `linesTerminatedBy` and `fieldsTerminatedBy` were not properly escaped.
- **Test Improvements**
- Improved test coverage and modularity
  - Removed redundant monolithic tool files (`performance.ts`, `text.ts`)
  - Enhanced `cli.ts` tests for argument parsing and pool configuration
  - Improved `MySQLAdapter` transaction error handling tests
  - Added resilience tests for `innodb` resource
- Refactored `ToolFilter` into `ToolConstants`
- Refactored `shell.test.ts` into 5 modular files and improved coverage for shell, spatial, and sysschema tools with meaningful assertions.
- **Resource Test Refactoring** - Split monolithic `handlers.test.ts` and `diagnostics.test.ts` into 10 modular test files (`spatial`, `status`, `sysschema`, `pool`, `processlist`, `capabilities`, `tables`, `innodb`, `performance`, `schema`) to improve maintainability.
- **Coverage Boost** - Achieved >80% branch coverage by adding meaningful edge-case tests for resources (handling null results, empty sets) and tool filters.
- **CLI & Tool Coverage** - Added comprehensive tests for:
  - CLI argument parsing (`args.test.ts`)
  - Document Store validation (`docstore.test.ts`)
  - Performance resource error handling (`performance.test.ts`)
  - Schema management tools (`management.test.ts`)

### Added

- **85 New Tools** for comprehensive MySQL 8.0 coverage (106 → 191 tools total):

  **Schema Management (10 tools)** - `schema` group:
  - `mysql_list_schemas`, `mysql_create_schema`, `mysql_drop_schema`, `mysql_list_views`, `mysql_create_view`, `mysql_list_stored_procedures`, `mysql_list_functions`, `mysql_list_triggers`, `mysql_list_constraints`, `mysql_list_events`

  **Event Scheduler (6 tools)** - `events` group:
  - `mysql_event_create`, `mysql_event_alter`, `mysql_event_drop`, `mysql_event_list`, `mysql_event_status`, `mysql_scheduler_status`

  **sys Schema Diagnostics (8 tools)** - `sysschema` group:
  - `mysql_sys_user_summary`, `mysql_sys_io_summary`, `mysql_sys_statement_summary`, `mysql_sys_wait_summary`, `mysql_sys_innodb_lock_waits`, `mysql_sys_schema_stats`, `mysql_sys_host_summary`, `mysql_sys_memory_summary`

  **Statistical Analysis (8 tools)** - `stats` group:
  - `mysql_stats_descriptive`, `mysql_stats_percentiles`, `mysql_stats_correlation`, `mysql_stats_distribution`, `mysql_stats_time_series`, `mysql_stats_regression`, `mysql_stats_sampling`, `mysql_stats_histogram`

  **Spatial/GIS (12 tools)** - `spatial` group:
  - `mysql_spatial_create_column`, `mysql_spatial_create_index`, `mysql_spatial_point`, `mysql_spatial_polygon`, `mysql_spatial_distance`, `mysql_spatial_distance_sphere`, `mysql_spatial_contains`, `mysql_spatial_within`, `mysql_spatial_intersection`, `mysql_spatial_buffer`, `mysql_spatial_transform`, `mysql_spatial_geojson`

  **Security (9 tools)** - `security` group:
  - `mysql_security_audit`, `mysql_security_firewall_status`, `mysql_security_firewall_rules`, `mysql_security_mask_data`, `mysql_security_password_validate`, `mysql_security_ssl_status`, `mysql_security_user_privileges`, `mysql_security_sensitive_tables`, `mysql_security_encryption_status`

  **Group Replication & InnoDB Cluster (10 tools)** - `cluster` group:
  - `mysql_gr_status`, `mysql_gr_members`, `mysql_gr_primary`, `mysql_gr_transactions`, `mysql_gr_flow_control`, `mysql_cluster_status`, `mysql_cluster_instances`, `mysql_cluster_topology`, `mysql_cluster_router_status`, `mysql_cluster_switchover`

  **Role Management (8 tools)** - `roles` group:
  - `mysql_role_list`, `mysql_role_create`, `mysql_role_drop`, `mysql_role_grants`, `mysql_role_grant`, `mysql_role_assign`, `mysql_role_revoke`, `mysql_user_roles`

  **Document Store (9 tools)** - `docstore` group:
  - `mysql_doc_list_collections`, `mysql_doc_create_collection`, `mysql_doc_drop_collection`, `mysql_doc_find`, `mysql_doc_add`, `mysql_doc_modify`, `mysql_doc_remove`, `mysql_doc_create_index`, `mysql_doc_collection_info`

  **Enhanced JSON (5 tools)** - added to `json` group (12 → 17):
  - `mysql_json_merge`, `mysql_json_diff`, `mysql_json_normalize`, `mysql_json_stats`, `mysql_json_index_suggest`

- **6 New Resources** for monitoring (12 → 18 resources):
  - `mysql://events` - Event Scheduler status and scheduled events
  - `mysql://sysschema` - sys schema diagnostics summary
  - `mysql://locks` - InnoDB lock contention detection
  - `mysql://cluster` - Group Replication/InnoDB Cluster status
  - `mysql://spatial` - Spatial columns and indexes
  - `mysql://docstore` - Document Store collections

- **5 New Prompts** for guided workflows (14 → 19 prompts):
  - `mysql_setup_events` - Event Scheduler setup guide
  - `mysql_sys_schema_guide` - sys schema usage and diagnostics
  - `mysql_setup_spatial` - Spatial/GIS data setup guide
  - `mysql_setup_cluster` - InnoDB Cluster/Group Replication guide
  - `mysql_setup_docstore` - Document Store / X DevAPI guide

- **2 New Meta-Groups** for tool filtering:
  - `dba` (~70 tools) - DBA tasks (admin, monitoring, security, sysschema, roles)
  - `ai` (~85 tools) - AI/ML features (docstore, spatial, JSON, stats)

### Changed

- Tool groups increased from 15 to 24 (9 new groups)
- JSON tools increased from 12 to 17
- Updated meta-groups: `starter` (~45), `dev` (~65), `base` (~160)
- README updated with new tool groups and meta-groups

### Fixed

- **`ai` meta-group now implemented** - Previously documented in v1.1.0 changelog but missing from code. Now fully functional with 77 tools for AI/ML workloads (JSON, Document Store, spatial, statistics)
- **Tool count accuracy** - Corrected all tool counts in README:
  - `starter`: 38 tools (was ~33)
  - `dev`: 67 tools (was ~65)
  - `ai`: 77 tools (was ~85)
  - `dba`: 103 tools (was ~70)
- **README improvements** - Rewrote Tool Filtering section with beginner-friendly explanations, step-by-step filter examples, and syntax reference table

### Changed

- Updated `MetaGroup` type in `types/index.ts` to include `ai`
- Added detailed tool count comments in `ToolFilter.ts`

### Added - Documentation

- **MCP Inspector Usage Guide** - Added documentation in README and Wiki for using MCP Inspector to visually test and debug mysql-mcp servers ([Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/MCP-Inspector))

### Added - Testing

- **Comprehensive Test Suite** - 1168 tests across 54 test files (>95% global statement coverage)
- [x] Fix remaining test failures
- [x] Achieve 90% test coverage with meaningful tests
- [ ] Add remaining tool definitions
- [ ] Implement remaining handlers
- **Test Quality Improvements** - Replaced coverage booster tests with meaningful assertions:
  - `prompts.test.ts`: 15 content verification assertions (e.g., checking for "migration", "CREATE TABLE")
  - `resources.test.ts`: 5 handler execution smoke tests with adapter method verification
  - `sysschema.test.ts`: Comprehensive structure assertions and default parameter handling
  - Core modules: ToolFilter (42), ConnectionPool (30), McpServer (26)
  - Tool groups: All 24 groups tested with handler execution tests
  - Resources: All 18 resources tested with handler execution tests
  - Prompts: All 19 prompts tested for names, arguments, handlers
  - Adapters: DatabaseAdapter (45), MySQLAdapter (25)
  - OAuth: Scopes (30), OAuthResourceServer (21), Errors (21+), AuthorizationServerDiscovery (20+), TokenValidator (17), Middleware (32)
  - Infrastructure: McpLogging (22), ProgressReporter (21), HTTP Transport (20)
- **New Test Files** (7 added):
  - `src/auth/__tests__/errors.test.ts` - All OAuth error classes tested
  - `src/auth/__tests__/AuthorizationServerDiscovery.test.ts` - RFC 8414 metadata discovery, caching, error handling
  - `src/logging/__tests__/McpLogging.test.ts` - Log level filtering, configuration, convenience methods
  - `src/progress/__tests__/ProgressReporter.test.ts` - Progress notifications, factory, error handling
  - `src/auth/__tests__/OAuthResourceServer.test.ts` - RFC 9728 metadata, scope validation
  - `src/adapters/mysql/resources/__tests__/handlers.test.ts` - Resource handler execution tests
  - `src/transports/__tests__/http.test.ts` - CORS, health check, OAuth metadata
  - `src/adapters/mysql/tools/schema/__tests__/*.test.ts` - 6 modular test files for schema management
- **Modular Refactoring Phase 3**:
  - Refactored `schema.ts` (monolithic) into `tools/schema/` (management, views, routines, triggers, constraints, scheduled_events).
  - Deleted legacy monolithic files `admin.ts` and `sysschema.ts`.
  - Refactored tests to match modular structure, deleting legacy test files `admin.test.ts`, `sysschema.test.ts`, `schema.test.ts` and duplicates.
- **HTTP/SSE Transport Integration**:
  - Fully implemented SSE request handling in `src/transports/http.ts`
  - Integrated `HttpTransport` class into `McpServer.ts` startup logic
  - Added support for `/sse` and `/messages` endpoints compliant with MCP protocol
  - Enabled OAuth authentication for HTTP transport via `OAuthResourceServer` and `TokenValidator` integration
- **Centralized Mock Infrastructure**:
  - New `src/__tests__/mocks/index.ts` - Barrel export for all mock factories
  - `createMockMySQLAdapter()` - Full adapter mock with all methods
  - `createMockMySQLAdapterEmpty()` - Adapter returning empty results
  - `createMockMySQLAdapterWithError()` - Adapter that throws on queries
  - `createMockMySQLAdapterWithTransaction()` - Transaction-enabled mock
  - `createMockRequestContext()` - Mock RequestContext for handler tests
- **Handler Execution Tests** - Core and transaction tools include handler behavior tests
- **Test Scripts**:
  - `npm test` - Run all tests
  - `npm run test:coverage` - Run with coverage report (v8 provider)
  - `npm run test:watch` - Watch mode for development
- Tests run without database connection (fully mocked)
- ~10 second total test runtime
- **Integration Tests**:
  - `src/adapters/mysql/__tests__/MySQLAdapter.integration.test.ts` - Non-mocked tests against real MySQL Docker container
  - Verifies connection, CRUD operations, and transaction commit/rollback
  - **Coverage Improvements**:
  - Global statement coverage: **>95%**
  - Branch coverage: **~79%**
  - **Testing**: Achieved >95% global statement coverage and ~79% branch coverage across the codebase.
- **Testing**: Added comprehensive unit tests for `src/cli.ts` (91% coverage) including flag parsing, help output, and environment fallbacks.
- **Testing**: Significantly improved tool handler coverage for `cluster`, `shell`, `sysschema`, `security`, and `text` modules.
- **Testing**: Added tests for `health` resource and `indexTuning` prompt.
  - **Tool Coverage**: Added meaningful edge-case tests for `cluster`, `shell`, `sysschema`, `security`, and `text` tools (verification of queries, fallbacks, and error handling)
- **Coverage Boost**: achieved >80% branch coverage by refactoring and adding dedicated tests for:
  - `spatial` tools (now comprehensive with validation and fallback tests)
  - `sysschema` tools (now comprehensive with default checks)
  - `json` tools (high coverage)
  - `roles` tools (high coverage)
  - `text` tools (full coverage including optional parameters)
  - `docstore` tools (full coverage including result parsing and complex updates)
  - `admin` tools (comprehensive coverage for maintenance, monitoring, and backup)
  - `performance` tools (coverage for analysis and optimization)
  - Resources: `docstore`, `events`, `status`, `variables`, `indexes`, `locks` (now comprehensively tested)

## [1.0.0] - 2025-12-13

### Added

- **MySQL Router Support** - 9 new tools for monitoring MySQL Router via REST API
  - `mysql_router_status` - Get Router process status and version
  - `mysql_router_routes` - List all configured routes
  - `mysql_router_route_status` - Get status of a specific route
  - `mysql_router_route_health` - Check health/liveness of a route
  - `mysql_router_route_connections` - List active connections on route
  - `mysql_router_route_destinations` - List backend MySQL server destinations
  - `mysql_router_route_blocked_hosts` - List blocked IP addresses for a route
  - `mysql_router_metadata_status` - InnoDB Cluster metadata cache status _(requires InnoDB Cluster)_
  - `mysql_router_pool_status` - Connection pool statistics _(requires InnoDB Cluster)_
- New `router` tool group for filtering Router tools
- Router REST API configuration via environment variables
- Comprehensive Router setup documentation in README
- **ProxySQL Support** - 12 new tools for monitoring ProxySQL proxy
  - `proxysql_status` - Get ProxySQL version, uptime, and runtime stats
  - `proxysql_servers` - List configured backend MySQL servers
  - `proxysql_hostgroups` - List hostgroup configurations and connection stats
  - `proxysql_query_rules` - List query routing rules
  - `proxysql_query_digest` - Get query digest statistics (top queries)
  - `proxysql_connection_pool` - Get connection pool statistics per server
  - `proxysql_users` - List configured MySQL users
  - `proxysql_global_variables` - Get global variables (mysql-_ and admin-_)
  - `proxysql_runtime_status` - Get runtime configuration status
  - `proxysql_memory_stats` - Get memory usage metrics
  - `proxysql_commands` - Execute LOAD/SAVE admin commands
  - `proxysql_process_list` - Get active sessions like SHOW PROCESSLIST
- New `proxysql` tool group for filtering ProxySQL tools
- ProxySQL admin interface configuration via environment variables
- Comprehensive ProxySQL setup documentation in README
- **MySQL Shell Support** - 10 new tools for MySQL Shell 8.0 integration
  - `mysqlsh_version` - Get MySQL Shell version and installation status
  - `mysqlsh_check_upgrade` - Check server upgrade compatibility
  - `mysqlsh_export_table` - Export table to file (CSV, TSV)
  - `mysqlsh_import_table` - Parallel table import from file
  - `mysqlsh_import_json` - Import JSON documents to collection or table
  - `mysqlsh_dump_instance` - Dump entire MySQL instance
  - `mysqlsh_dump_schemas` - Dump selected schemas
  - `mysqlsh_dump_tables` - Dump specific tables
  - `mysqlsh_load_dump` - Load MySQL Shell dump
  - `mysqlsh_run_script` - Execute JS/Python/SQL script via MySQL Shell
- New `shell` tool group for filtering MySQL Shell tools
- MySQL Shell configuration via environment variables (MYSQLSH_PATH, MYSQLSH_TIMEOUT, MYSQLSH_WORK_DIR)
- Comprehensive MySQL Shell setup documentation in README

### Changed

- Total tools increased from 75 to 106
- Tool groups increased from 12 to 15
- Updated `.env.example` with Router and ProxySQL configuration templates
- Updated minimal preset to exclude Router, ProxySQL, and Shell tools by default

### Fixed

- **Prompt Parameter Passing** - Fixed issue where prompt arguments showed `undefined` instead of actual values. Prompts now properly pass arguments from MCP clients to handlers.

## [0.1.0] - 2025-12-13

### Added

- **84 MySQL tools** across 13 categories
- **4 AI-Powered Prompts** for guided MySQL workflows:
  - `mysql_query_builder` - Help construct SQL queries with security best practices
  - `mysql_schema_design` - Design table schemas with indexes and relationships
  - `mysql_performance_analysis` - Analyze slow queries with optimization recommendations
  - `mysql_migration` - Generate migration scripts with rollback and online migration options
- Core database operations (CRUD, schema, tables)
- JSON operations (MySQL 5.7+)
- Text processing (REGEXP, LIKE, SOUNDEX)
- FULLTEXT search support
- Performance tools (EXPLAIN, query analysis)
- Optimization tools (index hints, recommendations)
- Admin tools (OPTIMIZE, ANALYZE, FLUSH)
- Monitoring tools (PROCESSLIST, status variables)
- Backup tools (export, import, mysqldump format)
- Replication tools (master/slave, binlog, GTID)
- Partitioning tools (partition management)
- Transaction tools (BEGIN, COMMIT, ROLLBACK, savepoints)
- MySQL Router tools (status, routes, health monitoring)
- **Tool Filtering System** - Filter by group or individual tools
- **OAuth 2.0 Support** - Keycloak integration for enterprise auth
- **Connection Pooling** - Configurable mysql2 pool
- **Multiple Transports** - stdio, HTTP, SSE
- MCP SDK integration
- Comprehensive documentation and examples

### Security

- SQL injection prevention via parameterized queries
- OAuth 2.0 scope-based access control
- Environment variable configuration for sensitive data

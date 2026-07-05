# Tool Reference

Complete list of all **241 tools** across 28 categories.

> Every tool returns structured `{success, error}` responses — no raw exceptions, no silent failures. See the README for details.

---

## Core Database (12 tools)

| Tool                   | Description                           |
| ---------------------- | ------------------------------------- |
| `mysql_read_query`     | Execute SELECT with parameter binding |
| `mysql_write_query`    | Execute INSERT/UPDATE/DELETE          |
| `mysql_list_tables`    | List tables with metadata             |
| `mysql_describe_table` | Get column definitions                |
| `mysql_create_table`   | CREATE TABLE with engine/charset      |
| `mysql_drop_table`         | DROP TABLE with IF EXISTS               |
| `mysql_create_index`       | CREATE INDEX (BTREE, HASH, FULLTEXT)    |
| `mysql_get_indexes`        | SHOW INDEX FROM table                   |
| `mysql_enable_versioning`  | Enable OCC on a table                   |
| `mysql_disable_versioning` | Disable OCC on a table                  |
| `mysql_check_version`      | Get current _version of a row           |
| `mysql_conditional_update` | Update row conditionally based on version |

---

## Schema Management (11 tools)

| Tool                           | Description                  |
| ------------------------------ | ---------------------------- |
| `mysql_list_schemas`           | List databases/schemas       |
| `mysql_create_schema`          | CREATE DATABASE              |
| `mysql_drop_schema`            | DROP DATABASE                |
| `mysql_list_views`             | List views in schema         |
| `mysql_create_view`            | CREATE OR REPLACE VIEW       |
| `mysql_drop_view`              | DROP VIEW                    |
| `mysql_list_stored_procedures` | List stored procedures       |
| `mysql_list_functions`         | List stored functions        |
| `mysql_list_triggers`          | List triggers                |
| `mysql_list_constraints`       | List foreign keys and checks |
| `mysql_list_events`            | List scheduled events        |

---

## Transactions (7 tools)

| Tool                            | Description                            |
| ------------------------------- | -------------------------------------- |
| `mysql_transaction_begin`       | START TRANSACTION with isolation level |
| `mysql_transaction_commit`      | COMMIT                                 |
| `mysql_transaction_rollback`    | ROLLBACK                               |
| `mysql_transaction_savepoint`   | SAVEPOINT name                         |
| `mysql_transaction_release`     | RELEASE SAVEPOINT                      |
| `mysql_transaction_rollback_to` | ROLLBACK TO SAVEPOINT                  |
| `mysql_transaction_execute`     | Execute statements atomically          |

---

## JSON Operations (17 tools)

| Tool                       | Description                            |
| -------------------------- | -------------------------------------- |
| `mysql_json_extract`       | JSON_EXTRACT with path                 |
| `mysql_json_set`           | JSON_SET to modify values              |
| `mysql_json_insert`        | JSON_INSERT (no overwrite)             |
| `mysql_json_replace`       | JSON_REPLACE (only existing)           |
| `mysql_json_remove`        | JSON_REMOVE paths                      |
| `mysql_json_contains`      | JSON_CONTAINS for filtering            |
| `mysql_json_keys`          | JSON_KEYS to list object keys          |
| `mysql_json_array_append`  | JSON_ARRAY_APPEND                      |
| `mysql_json_get`           | Simple JSON value extraction           |
| `mysql_json_update`        | Update JSON field by path              |
| `mysql_json_search`        | Search JSON for string value           |
| `mysql_json_validate`      | Validate JSON structure                |
| `mysql_json_merge`         | JSON_MERGE_PATCH / PRESERVE            |
| `mysql_json_diff`          | Compare two JSON documents             |
| `mysql_json_normalize`     | Normalize keys and formats             |
| `mysql_json_stats`         | Calculate depth, keys count, size      |
| `mysql_json_index_suggest` | Suggest generated columns for indexing |

---

## Document Store (9 tools)

> Treat MySQL like a NoSQL document database (MySQL 5.7+).

| Tool                          | Description                           |
| ----------------------------- | ------------------------------------- |
| `mysql_doc_list_collections`  | List JSON collections                 |
| `mysql_doc_create_collection` | Create new collection                 |
| `mysql_doc_drop_collection`   | Drop collection                       |
| `mysql_doc_find`              | Find documents (NoSQL-style criteria) |
| `mysql_doc_add`               | Add documents to collection           |
| `mysql_doc_modify`            | Modify documents matching criteria    |
| `mysql_doc_remove`            | Remove documents matching criteria    |
| `mysql_doc_create_index`      | Create index on JSON path             |
| `mysql_doc_collection_info`   | Get collection stats                  |

---

## Text Processing (6 tools)

| Tool                      | Description               |
| ------------------------- | ------------------------- |
| `mysql_regexp_match`      | REGEXP pattern matching   |
| `mysql_like_search`       | LIKE with wildcards       |
| `mysql_soundex`           | SOUNDEX phonetic matching |
| `mysql_substring`         | SUBSTRING extraction      |
| `mysql_concat`            | String concatenation      |
| `mysql_collation_convert` | Character set conversion  |

---

## FULLTEXT Search (5 tools)

| Tool                     | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `mysql_fulltext_create`  | Create FULLTEXT index                                             |
| `mysql_fulltext_drop`    | Drop FULLTEXT index                                               |
| `mysql_fulltext_search`  | MATCH...AGAINST natural language. **v2.2:** `maxLength` parameter |
| `mysql_fulltext_boolean` | Boolean mode search. **v2.2:** `maxLength` parameter              |
| `mysql_fulltext_expand`  | WITH QUERY EXPANSION. **v2.2:** `maxLength` parameter             |

---

## Spatial / GIS (12 tools)

| Tool                            | Description                        |
| ------------------------------- | ---------------------------------- |
| `mysql_spatial_create_column`   | Add POINT/POLYGON column with SRID |
| `mysql_spatial_create_index`    | Create SPATIAL index               |
| `mysql_spatial_point`           | Create POINT from coords           |
| `mysql_spatial_polygon`         | Create POLYGON from points         |
| `mysql_spatial_distance`        | ST_Distance (Cartesian)            |
| `mysql_spatial_distance_sphere` | ST_Distance_Sphere (Earth)         |
| `mysql_spatial_contains`        | ST_Contains check                  |
| `mysql_spatial_within`          | ST_Within check                    |
| `mysql_spatial_intersection`    | Get geometry intersection          |
| `mysql_spatial_buffer`          | Create buffer around geometry      |
| `mysql_spatial_transform`       | Transform SRID (CS conversion)     |
| `mysql_spatial_geojson`         | Import/Export GeoJSON              |

---

## Statistics (20 tools)

| Tool                        | Description                           |
| --------------------------- | ------------------------------------- |
| `mysql_stats_descriptive`   | Mean, median, stddev, variance        |
| `mysql_stats_percentiles`   | Calculate percentiles (p50, p90, p99) |
| `mysql_stats_correlation`   | Pearson correlation coefficient       |
| `mysql_stats_distribution`  | Frequency distribution                |
| `mysql_stats_time_series`   | Time-bucketed aggregation             |
| `mysql_stats_regression`    | Simple linear regression              |
| `mysql_stats_sampling`      | Random row sampling                   |
| `mysql_stats_histogram`     | Generate histogram buckets            |
| `mysql_stats_row_number`    | ROW_NUMBER() window function          |
| `mysql_stats_rank`          | RANK()/DENSE_RANK() window function   |
| `mysql_stats_lag_lead`      | LAG()/LEAD() window function          |
| `mysql_stats_running_total` | Running total window function         |
| `mysql_stats_moving_avg`    | Moving average window function        |
| `mysql_stats_ntile`         | NTILE() window function               |
| `mysql_stats_hypothesis`    | T-Test/Chi-Square hypothesis testing  |
| `mysql_stats_outliers`      | Z-Score/IQR outlier detection         |
| `mysql_stats_top_n`         | Top N items per category              |
| `mysql_stats_distinct`      | Count distinct values                 |
| `mysql_stats_frequency`     | Value frequency and mode              |
| `mysql_stats_summary`       | Comprehensive numeric summary         |

---

## Performance (11 tools)

| Tool                            | Description                                                           |
| ------------------------------- | --------------------------------------------------------------------- |
| `mysql_explain`                 | EXPLAIN query execution plan. **v2.2:** JSON/TREE/TRADITIONAL formats |
| `mysql_explain_analyze`         | EXPLAIN ANALYZE (MySQL 8.0)                                           |
| `mysql_slow_queries`            | Query slow query log                                                  |
| `mysql_query_stats`             | Performance schema stats                                              |
| `mysql_index_usage`             | Index usage statistics                                                |
| `mysql_table_stats`             | Table statistics. **v2.2:** P154 existence check                      |
| `mysql_buffer_pool_stats`       | InnoDB buffer pool info                                               |
| `mysql_thread_stats`            | Thread activity stats                                                 |
| `mysql_detect_query_anomalies`  | Detect unusual query execution patterns                               |
| `mysql_detect_bloat_risk`       | Identify tables with high risk of fragmentation                       |
| `mysql_detect_connection_spike` | Detect connection pool anomalies                                      |

---

## Optimization (4 tools)

| Tool                         | Description                                        |
| ---------------------------- | -------------------------------------------------- |
| `mysql_index_recommendation` | Suggest missing indexes. **v2.2:** `queries`, `includeRedundant`, `includeUnindexed` params |
| `mysql_query_rewrite`        | Query optimization hints                           |
| `mysql_force_index`          | Generate FORCE INDEX hints                         |
| `mysql_optimizer_trace`      | View optimizer decisions. **v2.2:** `summary` mode |

---

## Admin (9 tools)

| Tool                   | Description              |
| ---------------------- | ------------------------ |
| `mysql_optimize_table` | OPTIMIZE TABLE           |
| `mysql_analyze_table`  | ANALYZE TABLE statistics |
| `mysql_check_table`    | CHECK TABLE integrity    |
| `mysql_repair_table`   | REPAIR TABLE (MyISAM)    |
| `mysql_flush_tables`   | FLUSH TABLES             |
| `mysql_kill_query`     | KILL connection/query    |
| `mysql_append_insight` | Append insight to log    |
| `mysql_server_config`  | Manage server configs    |
| `mysql_audit_search`   | Search and filter system audit logs |

---

## Security (9 tools)

| Tool                               | Description                                        |
| ---------------------------------- | -------------------------------------------------- |
| `mysql_security_audit`             | Audit user privileges and settings                 |
| `mysql_security_firewall_status`   | Firewall status (Enterprise/MariaDB)               |
| `mysql_security_firewall_rules`    | List firewall rules                                |
| `mysql_security_mask_data`         | Mask PII data patterns                             |
| `mysql_security_password_validate` | check password strength policy                     |
| `mysql_security_ssl_status`        | SSL/TLS connection status                          |
| `mysql_security_user_privileges`   | List privileges for user. **v2.2:** `summary` mode |
| `mysql_security_sensitive_tables`  | Scan for sensitive table names                     |
| `mysql_security_encryption_status` | TDE/Encryption-at-rest status                      |

---

## Roles (8 tools)

> MySQL 8.0+ Role Management

| Tool                | Description                |
| ------------------- | -------------------------- |
| `mysql_role_list`   | List defined roles         |
| `mysql_role_create` | CREATE ROLE                |
| `mysql_role_drop`   | DROP ROLE                  |
| `mysql_role_grants` | SHOW GRANTS FOR role       |
| `mysql_role_grant`  | GRANT privileges TO role   |
| `mysql_role_assign` | GRANT role TO user         |
| `mysql_role_revoke` | REVOKE role FROM user      |
| `mysql_user_roles`  | List active roles for user |

---

## Monitoring (7 tools)

| Tool                       | Description                                         |
| -------------------------- | --------------------------------------------------- |
| `mysql_show_processlist`   | SHOW PROCESSLIST                                    |
| `mysql_show_status`        | SHOW STATUS variables                               |
| `mysql_show_variables`     | SHOW VARIABLES                                      |
| `mysql_innodb_status`      | SHOW ENGINE INNODB STATUS. **v2.2:** `summary` mode |
| `mysql_replication_status` | SHOW SLAVE STATUS                                   |
| `mysql_pool_stats`         | Connection pool statistics                          |
| `mysql_server_health`      | Server health check                                 |

---

## sys Schema (8 tools)

| Tool                          | Description                 |
| ----------------------------- | --------------------------- |
| `mysql_sys_user_summary`      | Resource usage by user. **v3.2:** strict validation and aliases      |
| `mysql_sys_io_summary`        | I/O usage by thread/file    |
| `mysql_sys_statement_summary` | Statement analysis          |
| `mysql_sys_wait_summary`      | Wait events analysis        |
| `mysql_sys_innodb_lock_waits` | Blocked transactions info   |
| `mysql_sys_schema_stats`      | Table/index sizes and bloat |
| `mysql_sys_host_summary`      | Metrics by source host. **v3.2:** strict validation and aliases      |
| `mysql_sys_memory_summary`    | Memory usage breakdown      |

---

## Backup (7 tools)

| Tool                         | Description                                                         |
| ---------------------------- | ------------------------------------------------------------------- |
| `mysql_export_table`         | Export table to SQL/CSV. **v2.2:** `limit` parameter (default: 5) |
| `mysql_import_data`          | LOAD DATA INFILE                                                    |
| `mysql_create_dump`          | mysqldump command generation                                        |
| `mysql_restore_dump`         | Restore from dump                                                   |
| `mysql_audit_list_backups`   | List available snapshots                                            |
| `mysql_audit_restore_backup` | Restore a snapshot                                                  |
| `mysql_audit_diff_backup`    | Diff a snapshot                                                     |

---

## Replication (5 tools)

| Tool                    | Description               |
| ----------------------- | ------------------------- |
| `mysql_master_status`   | SHOW MASTER STATUS        |
| `mysql_slave_status`    | SHOW SLAVE STATUS         |
| `mysql_binlog_events`   | SHOW BINLOG EVENTS        |
| `mysql_gtid_status`     | GTID_EXECUTED status      |
| `mysql_replication_lag` | Calculate replication lag |

---

## Cluster (10 tools)

> Group Replication / InnoDB Cluster

| Tool                          | Description                                                      |
| ----------------------------- | ---------------------------------------------------------------- |
| `mysql_gr_status`             | Group Replication status                                         |
| `mysql_gr_members`            | List cluster members                                             |
| `mysql_gr_primary`            | Get/Set primary member                                           |
| `mysql_gr_transactions`       | Check distributed transactions                                   |
| `mysql_gr_flow_control`       | Tuning flow control                                              |
| `mysql_cluster_status`        | InnoDB Cluster overall status. **v2.2:** `summary` mode          |
| `mysql_cluster_instances`     | List instance details. **v2.2:** offline node reporting          |
| `mysql_cluster_topology`      | View cluster topology map. **v2.2:** offline instance visibility |
| `mysql_cluster_router_status` | Connected Routers. **v2.2:** `summary` mode                      |
| `mysql_cluster_switchover`    | Validates switchover readiness                                   |

---

## Partitioning (4 tools)

| Tool                         | Description           |
| ---------------------------- | --------------------- |
| `mysql_partition_info`       | Partition information |
| `mysql_add_partition`        | ADD PARTITION         |
| `mysql_drop_partition`       | DROP PARTITION        |
| `mysql_reorganize_partition` | REORGANIZE PARTITION  |

---

## Events (6 tools)

> MySQL Event Scheduler

| Tool                     | Description                  |
| ------------------------ | ---------------------------- |
| `mysql_event_create`     | CREATE EVENT                 |
| `mysql_event_alter`      | ALTER EVENT                  |
| `mysql_event_drop`       | DROP EVENT                   |
| `mysql_event_list`       | SHOW EVENTS                  |
| `mysql_event_status`     | Check event last run/status  |
| `mysql_scheduler_status` | Check if scheduler is ON/OFF |

---

## MySQL Router (9 tools)

> **Note:** Requires MySQL Router 8.0.17+ with REST API enabled. For InnoDB Cluster deployments, the cluster must be running for REST API authentication. See [[MySQL-Router]].

| Tool                               | Description                             | Parameters                             |
| ---------------------------------- | --------------------------------------- | -------------------------------------- |
| `mysql_router_status`              | Get Router process status and version   | None                                   |
| `mysql_router_routes`              | List all configured routes              | None                                   |
| `mysql_router_route_status`        | Get status of a specific route          | `routeName`                            |
| `mysql_router_route_health`        | Check health/liveness of a route        | `routeName`                            |
| `mysql_router_route_connections`   | List active connections on route        | `routeName`                            |
| `mysql_router_route_destinations`  | List backend MySQL server destinations  | `routeName`                            |
| `mysql_router_route_blocked_hosts` | List blocked IP addresses for a route   | `routeName`                            |
| `mysql_router_metadata_status`     | InnoDB Cluster metadata cache status ⚠️ | `metadataName` (typically `bootstrap`) |
| `mysql_router_pool_status`         | Connection pool statistics ⚠️           | `poolName`                             |

⚠️ = Requires InnoDB Cluster

---

## ProxySQL (11 tools)

> **Note:** Requires access to ProxySQL admin interface. See [[ProxySQL]].

| Tool                        | Description                                                                                        |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| `proxysql_status`           | Get ProxySQL version, uptime, and runtime stats. **v2.2:** `summary` mode                          |
| `proxysql_servers`          | List configured backend MySQL servers                                                              |
| `proxysql_query_rules`      | List query routing rules                                                                           |
| `proxysql_query_digest`     | Get query digest statistics (top queries)                                                          |
| `proxysql_connection_pool`  | Get connection pool statistics per server                                                          |
| `proxysql_users`            | List configured MySQL users                                                                        |
| `proxysql_global_variables` | Get global variables (mysql-_ and admin-_). **v2.2:** `limit`, `like` params; credential redaction |
| `proxysql_runtime_status`   | Get runtime configuration status. **v2.2:** `summary` mode; credential redaction                   |
| `proxysql_memory_stats`     | Get memory usage metrics                                                                           |
| `proxysql_commands`         | Execute LOAD/SAVE admin commands                                                                   |
| `proxysql_process_list`     | Get active sessions                                                                                |

---

## MySQL Shell (10 tools)

> **Note:** Requires MySQL Shell 8.0+ installed. See [[MySQL-Shell]].

| Tool                    | Description                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `mysqlsh_version`       | Get MySQL Shell version and installation status                                     |
| `mysqlsh_check_upgrade` | Check server upgrade compatibility                                                  |
| `mysqlsh_export_table`  | Export table to file (CSV, TSV)                                                     |
| `mysqlsh_import_table`  | Parallel table import. **v2.1:** `updateServerSettings` auto-enables `local_infile` |
| `mysqlsh_import_json`   | Import JSON documents to collection or table                                        |
| `mysqlsh_dump_instance` | Dump entire MySQL instance                                                          |
| `mysqlsh_dump_schemas`  | Dump selected schemas. **v2.1:** `ddlOnly` dumps only DDL                           |
| `mysqlsh_dump_tables`   | Dump specific tables. **v2.1:** `all` controls trigger inclusion                    |
| `mysqlsh_load_dump`     | Load MySQL Shell dump. **v2.1:** `updateServerSettings` auto-enables `local_infile` |
| `mysqlsh_run_script`    | Execute JS/Python/SQL script via MySQL Shell                                        |

---

## Vector (11 tools)

> Vector embeddings, KNN search, and hybrid search (MySQL 9.0+)

| Tool                           | Description                                                                 |
| ------------------------------ | --------------------------------------------------------------------------- |
| `mysql_vector_store`           | Store a single vector embedding                                             |
| `mysql_vector_batch_store`     | Bulk insert vector embeddings                                               |
| `mysql_vector_delete`          | Delete a vector by primary key                                              |
| `mysql_vector_get`             | Retrieve a vector by primary key                                            |
| `mysql_vector_search`          | Top-k nearest neighbors (KNN) search                                        |
| `mysql_vector_range_search`    | Find all vectors within a distance threshold                                |
| `mysql_vector_hybrid_search`   | Combine vector distance with FULLTEXT relevance using Reciprocal Rank Fusion. **v3.1:** `metric`, `rrfK`, `select`, `filter` parameters|
| `mysql_vector_info`            | View table vector columns and dimensions                                    |
| `mysql_vector_create_index`    | Create HNSW vector index (MySQL 9.1+)                                       |
| `mysql_vector_optimize`        | Optimize vector index statistics                                            |
| `mysql_vector_stats`           | Get vector dimension, count, and distance statistics                        |

---

## Introspection (6 tools)

> Pre-flight analysis, relationship mapping, and constraint validation tools to ensure schema modifications are safe.

| Tool                        | Description                                                                |
| --------------------------- | -------------------------------------------------------------------------- |
| `mysql_dependency_graph`    | Generate a deep relationship graph of tables based on foreign keys         |
| `mysql_topological_sort`    | Determine exact creation/deletion order for foreign key constraints        |
| `mysql_cascade_simulator`   | Simulate cascading deletes/updates without actual data modification        |
| `mysql_schema_snapshot`     | Capture the state of the schema definition at a given point in time        |
| `mysql_constraint_analysis` | Detect circular dependencies, missing indexes, and overlapping constraints |
| `mysql_migration_risks`     | Run pre-flight checks on DDL to identify downtime or locking risks         |

---

## Migration (6 tools)

> Integrated schema versioning and deployment tracker built directly into the MCP server.

| Tool                       | Description                                               |
| -------------------------- | --------------------------------------------------------- |
| `mysql_migration_init`     | Set up migration tracking tables in the database          |
| `mysql_migration_record`   | Manually record an out-of-band migration to the history   |
| `mysql_migration_apply`    | Apply a single forward migration step                     |
| `mysql_migration_rollback` | Revert a recently applied migration                       |
| `mysql_migration_history`  | View applied migrations history                           |
| `mysql_migration_status`   | Check the current state of applied vs. pending migrations |

---

## Code Mode (1 tool)

> Execute JavaScript in a worker-thread sandbox (separate V8 isolate) with access to all MySQL tools via `mysql.*` API. See [[Code-Mode]] for full API documentation.

| Tool                 | Description                                                          |
| -------------------- | -------------------------------------------------------------------- |
| `mysql_execute_code` | Execute code with access to all `mysql.*` APIs. 70-90% token savings |

---

## See Also

- [[Tool-Filtering]] - Reduce tool count for IDE limits
- [[Configuration]] - MCP client configuration

---

_Updated for v3.2.2 — June 14, 2026_

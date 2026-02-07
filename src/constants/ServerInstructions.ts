/**
 * Server instructions for MySQL MCP.
 *
 * These instructions are automatically sent to MCP clients during initialization,
 * providing guidance for AI agents on tool usage.
 */

import type {
  ToolGroup,
  ResourceDefinition,
  PromptDefinition,
} from "../types/index.js";
import { TOOL_GROUPS } from "../filtering/ToolConstants.js";

/**
 * Base instructions that are always included
 */
const BASE_INSTRUCTIONS = `# mysql-mcp Usage Instructions

## Server Identity

- **Server Name**: This server is identified as \`user-mysql\` in MCP client configurations.
- **Tool Invocation**: When calling tools via MCP, they are prefixed with the server name (e.g., \`user-mysql-mysql_json_extract\`, \`user-mysql-mysql_read_query\`).
- **Resources**: 
  - Resources use the \`mysql://\` URI scheme (e.g., \`mysql://capabilities\`, \`mysql://schema\`).
  - When listing or fetching resources, use server name \`user-mysql\` (e.g., \`list_mcp_resources(server: "user-mysql")\`, \`fetch_mcp_resource(server: "user-mysql", uri: "mysql://schema")\`).

## JSON Tools (\`mysql_json_*\`)

- **Automatic String Handling**: JSON tools automatically convert bare strings to valid JSON.
  - ✅ \`value: "green"\` → stored as JSON string \`"green"\`
  - ✅ \`value: 42\` → stored as number \`42\`
  - ✅ \`value: {"key": "val"}\` → stored as object
  - ✅ \`value: "[1,2,3]"\` → stored as array (already valid JSON)
- **Validation**: Creating or updating JSON values enforces JSON validity after auto-conversion.

## Transactions & Safety (\`mysql_transaction_*\`)

- **Interactive transactions**: Use \`mysql_transaction_begin\` → get \`transactionId\` → pass it to \`mysql_read_query\` or \`mysql_write_query\` for queries within the transaction → \`mysql_transaction_commit\` or \`mysql_transaction_rollback\`.
- **Atomic execution**: \`mysql_transaction_execute\` runs multiple SQL statements in a single atomic transaction. All succeed or all are rolled back. Returns \`rows\` and \`rowCount\` for SELECT statements, \`rowsAffected\` for write statements.
- **Isolation levels**: \`mysql_transaction_begin\` and \`mysql_transaction_execute\` accept optional \`isolationLevel\`: \`READ UNCOMMITTED\`, \`READ COMMITTED\`, \`REPEATABLE READ\` (default), \`SERIALIZABLE\`.
- **Savepoints**: Within an active transaction, use \`mysql_transaction_savepoint\` to create checkpoints, \`mysql_transaction_rollback_to\` for partial rollback, and \`mysql_transaction_release\` to remove a savepoint.

## Document Store (\`mysql_doc_*\`)

- **Collection creation**: \`mysql_doc_create_collection\` creates a JSON document collection. Use \`ifNotExists: true\` to avoid errors when the collection already exists.
- **Collection detection**: Tools identify document collections as tables containing a \`doc JSON\` column with an \`_id\` field. Manually created JSON tables may appear in collection listings.
- **Filter Syntax** (for \`mysql_doc_modify\`, \`mysql_doc_remove\`):
  - **By _id**: Pass the 32-character hex _id directly: \`filter: "686dd247b9724bcfa08ce6f1efed8b77"\`
  - **By field value**: Use \`field=value\` format: \`filter: "name=Alice"\` or \`filter: "age=30"\`
  - **By existence**: Use JSON path: \`filter: "$.address"\` (matches docs where address field exists)
  - ❌ Incorrect: \`filter: "$.name == 'Alice'"\` (comparison operators not supported in path)
  - ✅ Correct: \`filter: "name=Alice"\` (field=value format)
- **Find Filters** (\`mysql_doc_find\`): The filter parameter checks for field existence using JSON path (e.g., \`$.address.zip\`). Returns \`exists: false\` gracefully if the collection does not exist.

## Fulltext Search (\`mysql_fulltext_*\`)

- **Index management**: \`mysql_fulltext_create\` creates a FULLTEXT index (returns \`{ success: false, reason }\` if index already exists), \`mysql_fulltext_drop\` removes it (returns \`{ success: false, reason }\` if index does not exist).
- **Search modes**: \`mysql_fulltext_search\` supports NATURAL (default), BOOLEAN, and EXPANSION modes.
- **Boolean operators** (\`mysql_fulltext_boolean\`): \`+word\` (required), \`-word\` (excluded), \`word*\` (prefix wildcard), \`>word\`/\`<word\` (relevance weighting).
- **Query expansion** (\`mysql_fulltext_expand\`): Finds related terms - may return more rows than exact match.
- **Column matching**: MATCH column list must exactly match the columns of an existing FULLTEXT index. Searching a subset of indexed columns will fail.
- **Output**: Tools return only \`id\`, searched column(s), and \`relevance\` score. Use \`maxLength\` parameter to truncate long text columns in results (e.g., \`maxLength: 200\` truncates values over 200 characters with \`...\`).


## Backup Tools (\`mysql_export_table\`, \`mysql_import_data\`, etc.)

- **Export formats**: \`mysql_export_table\` supports SQL (INSERT statements) and CSV formats.
- **Limit rows**: Use \`limit\` parameter to control export size (recommended for large tables).
- **WHERE filtering**: Use \`where\` parameter to export subsets: \`where: "category = 'electronics'"\`.
- **CSV and JSON columns**: CSV export escapes JSON columns with double-quote encoding—valid but complex. Consider SQL format for JSON-heavy tables.
- **Import prerequisite**: \`mysql_import_data\` requires the target table to already exist. Returns \`{ exists: false, table }\` gracefully if the table does not exist.
- **Duplicate key handling**: \`mysql_import_data\` returns \`{ success: false, error, rowsInserted }\` for duplicate key violations instead of throwing, reporting how many rows were successfully inserted before the conflict.
- **Dump commands**: \`mysql_create_dump\` and \`mysql_restore_dump\` generate CLI commands—they do not execute directly.

## Core Tools (\`mysql_read_query\`, \`mysql_write_query\`, \`mysql_create_table\`, etc.)

- **Prepared statements**: \`mysql_read_query\` and \`mysql_write_query\` support parameterized queries via the \`params\` array. Use \`?\` placeholders: \`query: "SELECT * FROM users WHERE id = ?", params: [123]\`.
- **DDL statements**: DDL (e.g., \`CREATE TABLE\`, \`ALTER TABLE\`) is automatically handled via text protocol fallback in \`mysql_write_query\`.
- **Boolean defaults**: \`mysql_create_table\` auto-converts boolean \`default: true\` to \`1\` and \`default: false\` to \`0\` for MySQL compatibility. Alternatively, use \`TINYINT(1)\` with numeric defaults directly.
- **Existence checks**: \`mysql_describe_table\` and \`mysql_get_indexes\` return \`{ exists: false, table: "..." }\` gracefully when the table does not exist, avoiding raw SQL errors.
- **Index creation**: \`mysql_create_index\` supports BTREE (default), HASH, FULLTEXT, and SPATIAL types. Use \`ifNotExists: true\` to skip if the index already exists.
- **Table names**: All core tools support qualified names (\`schema.table\` format) for cross-database operations.

## Role Management (\`mysql_role_*\`, \`mysql_user_roles\`)

- **Privilege requirements**: Role management requires \`CREATE ROLE\`, \`DROP ROLE\`, \`GRANT\`, and \`REVOKE\` privileges.
- **Role lifecycle**: Create roles with \`mysql_role_create\`, grant privileges with \`mysql_role_grant\`, then assign to users with \`mysql_role_assign\`.
- **Listing roles**: \`mysql_role_list\` shows all defined roles. Use \`pattern\` parameter for LIKE-style filtering (e.g., \`pattern: "admin%"\`).
- **Privilege grants**: \`mysql_role_grant\` supports \`database.table\` syntax (e.g., \`table: "my_schema.my_table"\`). Use \`table: "*"\` for schema-wide privileges (e.g., \`testdb.*\`). Use \`privileges: ["SELECT", "INSERT"]\`.
- **Role assignment**: \`mysql_role_assign\` assigns a role to a user. Use \`withAdminOption: true\` to allow the user to grant the role to others.
- **User roles**: \`mysql_user_roles\` lists roles assigned to a user, including the \`admin\` flag (Y/N) indicating admin option status.
- **Existence checks**: \`mysql_role_grants\` returns \`exists: false\` if the role does not exist, avoiding raw SQL errors.

## Group Replication (\`mysql_gr_*\`)

- Tools check for \`group_replication\` plugin status and return "not active" if plugin is not active.

## InnoDB Cluster Tools (\`mysql_cluster_*\`)

- **Prerequisites**: Requires InnoDB Cluster infrastructure. Connect to a cluster node (typically via MySQL Router or directly). Cluster metadata schema (\`mysql_innodb_cluster_metadata\`) must exist.
- **Cluster status**: \`mysql_cluster_status\` returns cluster metadata. Use \`summary: true\` for condensed output without Router configuration schemas. Returns \`isInnoDBCluster: false\` if not in a cluster.
- **Instance list**: \`mysql_cluster_instances\` lists all configured instances with their current member state and role.
- **Topology**: \`mysql_cluster_topology\` provides an ASCII visualization grouping members by role (PRIMARY, secondaries, recovering, offline).
- **Router status**: \`mysql_cluster_router_status\` lists registered routers from cluster metadata. Use \`summary: true\` to return only essential router info without full configuration blobs.
- **Switchover analysis**: \`mysql_cluster_switchover\` evaluates replication lag on secondaries and provides target recommendations. Returns \`canSwitchover: false\` if no viable candidates.

## MySQL Router Tools (\`mysql_router_*\`)

- **Prerequisites**: MySQL Router must be running with REST API enabled. The REST API requires an InnoDB Cluster backend for authentication (uses \`metadata_cache\` credentials).
- **Self-signed certificates**: Set \`MYSQL_ROUTER_INSECURE=true\` to bypass TLS certificate verification for development/testing environments.
- **Route names**: Use \`mysql_router_routes\` to list available routes (e.g., \`bootstrap_rw\`, \`bootstrap_ro\`).
- **Metadata cache**: The \`metadataName\` parameter is typically \`bootstrap\` for bootstrapped routers.
- **Connection pools**: Pool name is typically \`main\` for standard Router configurations.
- **Unavailability handling**: When Router REST API is unreachable, tools return \`{ available: false, reason: "..." }\` with descriptive error message instead of throwing.

## Partitioning Tools (\`mysql_partition_*\`, \`mysql_add_partition\`, \`mysql_drop_partition\`, \`mysql_reorganize_partition\`)

- **Existence Check**: \`mysql_partition_info\` returns \`{ exists: false, table }\` when the table does not exist. Returns \`{ partitioned: false }\` for existing non-partitioned tables.
- **Value Parameter**: The \`value\` parameter expects only the boundary value, NOT the full SQL clause.
  - ❌ Incorrect: \`value: "LESS THAN (2024)"\` (SQL syntax error - duplicates keywords)
  - ✅ Correct: \`value: "2024"\` for RANGE partitions
  - ✅ Correct: \`value: "1,2,3"\` for LIST partitions (integer values)
  - ✅ Correct: \`value: "'region1','region2'"\` for LIST COLUMNS (quoted string values)
  - ✅ Correct: \`value: "4"\` for HASH/KEY (number of partitions to add)
- **Error Handling**: Write tools return \`{ success: false, error }\` for common failures (non-partitioned table, nonexistent partition, MAXVALUE conflicts) instead of throwing raw errors.
- **RANGE + MAXVALUE**: Adding a RANGE partition when a MAXVALUE catch-all exists returns a structured error suggesting \`mysql_reorganize_partition\` instead.
- **Reorganize**: Requires \`partitionType\` parameter (RANGE or LIST). HASH/KEY partitions cannot be reorganized.
- **Drop Warning**: \`mysql_drop_partition\` permanently deletes all data in the partition.

## Spatial Tools (\`mysql_spatial_*\`)

- **Coordinate Order**: All spatial tools use standard **longitude, latitude** parameter order (X, Y), matching GeoJSON and common mapping conventions.
  - ✅ Example: \`{ longitude: -122.4194, latitude: 37.7749 }\` for San Francisco
  - MySQL 8.0+ uses EPSG standard axis order (latitude, longitude) internally for SRID 4326, but tools handle this conversion automatically using \`axis-order=long-lat\` option.
- **SRID 4326**: Default spatial reference system is WGS 84 (GPS coordinates). Use \`srid\` parameter to specify other coordinate systems.
- **WKT Input**: When providing WKT geometry strings, use **longitude first** order: \`POINT(-122.4194 37.7749)\`.
- **SPATIAL Indexes**: \`mysql_spatial_create_index\` requires the column to be NOT NULL. The tool validates this and provides an ALTER TABLE suggestion if needed.
- **GeoJSON Conversion**: \`mysql_spatial_geojson\` converts between WKT and GeoJSON formats. \`mysql_spatial_point\`, \`mysql_spatial_polygon\`, \`mysql_spatial_intersection\`, \`mysql_spatial_buffer\`, and \`mysql_spatial_transform\` also return GeoJSON representations.
- **Buffer Segments**: \`mysql_spatial_buffer\` accepts an optional \`segments\` parameter (default: 8, MySQL default: 32) controlling the number of segments per quarter-circle in the buffer polygon approximation. Lower values produce simpler polygons with smaller payloads. Note: \`segments\` only takes effect with Cartesian geometries (SRID 0); geographic SRIDs (e.g., 4326) use MySQL's internal geographic buffer algorithm which does not support custom segment counts. The response includes \`segmentsApplied: true/false\` to indicate whether the parameter was effective.
- **Error Handling (P154)**: Table-querying tools (\`distance\`, \`distance_sphere\`, \`contains\`, \`within\`, \`create_column\`, \`create_index\`) return \`{ exists: false, table }\` for nonexistent tables. \`create_column\` returns \`{ success: false, reason }\` for duplicate columns. All tools return \`{ success: false, error }\` for invalid WKT, coordinates, SRIDs, or other MySQL errors instead of raw exceptions.

## Text Tools (\`mysql_like_search\`, \`mysql_regexp_match\`, etc.)

- **LIKE patterns**: \`%\` matches any characters, \`_\` matches single character.
- **Regex**: Uses MySQL regex syntax (not PCRE). Example: \`^[A-Z].*@.*\\.com$\`
- **SOUNDEX**: Finds phonetically similar values - matches alternative spellings (e.g., \`johndoe\` matches \`jonedoe\`).
- **WHERE clause**: All text tools support optional \`where\` parameter to filter rows. For pattern-matching tools (\`mysql_regexp_match\`, \`mysql_like_search\`, \`mysql_soundex\`), the \`where\` clause is combined with the pattern match using AND.
- **Concat columns**: \`mysql_concat\` includes source columns by default. Use \`includeSourceColumns: false\` for minimal payload (only id and concatenated result).
- **Minimal output**: Tools return only \`id\`, target column(s), and computed result with \`count\`.

## Performance Tools (\`mysql_explain\`, \`mysql_query_stats\`, etc.)

- **EXPLAIN formats**: \`mysql_explain\` supports JSON (default), TREE, and TRADITIONAL formats.
- **EXPLAIN ANALYZE**: \`mysql_explain_analyze\` shows actual execution times (MySQL 8.0+). Only TREE format is supported; JSON format returns \`{ supported: false, reason }\`.
- **Performance schema**: \`mysql_slow_queries\`, \`mysql_query_stats\`, and \`mysql_index_usage\` require \`performance_schema\` enabled.
- **Index usage**: \`mysql_index_usage\` filters to the current database by default. Use \`table\` parameter to filter further. Use \`limit\` (default: 50) to cap results.
- **Table stats**: \`mysql_table_stats\` returns \`{ exists: false, table: "..." }\` gracefully when the table does not exist.
- **Buffer pool**: \`mysql_buffer_pool_stats\` shows InnoDB memory usage and hit rates.
- **Thread stats**: \`mysql_thread_stats\` shows active threads with user, host, database, command, and connection type.

## Optimization Tools (\`mysql_index_recommendation\`, \`mysql_query_rewrite\`, etc.)

- **Index recommendations**: \`mysql_index_recommendation\` analyzes table structure and suggests missing indexes. Returns \`{ exists: false, table }\` when the table does not exist.
- **Query optimization**: \`mysql_query_rewrite\` analyzes queries for common anti-patterns (SELECT *, missing LIMIT, OR conditions, leading wildcards) and includes EXPLAIN output. Returns \`explainPlan: null\` with \`explainError\` when EXPLAIN fails (e.g., nonexistent table).
- **Force index**: \`mysql_force_index\` generates a query with \`FORCE INDEX\` hint for testing index behavior. Validates index existence and returns a \`warning\` if the index is not found on the table.
- **Optimizer trace**: \`mysql_optimizer_trace\` returns detailed MySQL optimizer decisions. Use \`summary: true\` for compact output with only key decisions (recommended for most cases).

## Admin Tools (\`mysql_optimize_table\`, \`mysql_repair_table\`, etc.)

- **Optimize**: \`mysql_optimize_table\` reclaims unused space (InnoDB does recreate + analyze).
- **Analyze**: \`mysql_analyze_table\` updates index statistics for the query optimizer.
- **Check**: \`mysql_check_table\` verifies table integrity. Options: QUICK, FAST, MEDIUM, EXTENDED, CHANGED.
- **Repair**: \`mysql_repair_table\` only works for MyISAM tables; InnoDB reports "not supported."
- **Flush**: \`mysql_flush_tables\` writes cached changes to disk.
- **Kill**: \`mysql_kill_query\` terminates queries by process ID. Use \`connection: true\` to kill the entire connection.

## Monitoring Tools (\`mysql_show_processlist\`, \`mysql_server_health\`, etc.)

- **Process list**: \`mysql_show_processlist\` shows active queries. Use \`full: true\` for complete query text.
- **Status/Variables**: \`mysql_show_status\` and \`mysql_show_variables\` accept \`like\` parameter for filtering (e.g., \`like: "%connections%"\`).
- **Server health**: \`mysql_server_health\` returns latency, version, uptime, and pool stats in a single call.
- **InnoDB status**: \`mysql_innodb_status\` returns InnoDB engine monitor output. Use \`summary: true\` for parsed key metrics (buffer pool, row ops, transactions).
- **Replication**: \`mysql_replication_status\` shows replica/slave status. Returns \`configured: false\` if replication is not set up.
- **Pool stats**: \`mysql_pool_stats\` returns connection pool metrics (total, active, idle, waiting connections).

## Replication Tools (\`mysql_master_status\`, \`mysql_slave_status\`, etc.)

- **Master status**: \`mysql_master_status\` returns current binlog file, position, and GTID set from the source server.
- **Slave status**: \`mysql_slave_status\` returns detailed replica status. Returns \`configured: false\` if not a replica.
- **Binlog events**: \`mysql_binlog_events\` shows binary log events. Use \`logFile\`, \`position\`, and \`limit\` to filter. Defaults to the **oldest** available binlog file when \`logFile\` is omitted—use \`mysql_master_status\` to find the current file. Returns \`{ success: false, error }\` gracefully for nonexistent binlog files.
- **GTID status**: \`mysql_gtid_status\` shows GTID mode (ON/OFF) and executed/purged transaction sets.
- **Replication lag**: \`mysql_replication_lag\` calculates delay in seconds. Returns \`lagSeconds: null\` if not a replica.

## Events Tools (\`mysql_event_*\`, \`mysql_scheduler_status\`)

- **Scheduler status**: \`mysql_scheduler_status\` shows global scheduler state (ON/OFF), event counts, and recently executed events.
- **Event types**: \`mysql_event_create\` supports ONE TIME (specify \`executeAt\`) and RECURRING (specify \`interval\`, \`intervalUnit\`, optional \`starts\`/\`ends\`). Use \`ifNotExists: true\` to skip creation if the event already exists.
- **Graceful error handling**: \`mysql_event_create\` returns \`{ success: false, reason }\` when the event already exists (without \`ifNotExists\`). \`mysql_event_alter\` and \`mysql_event_drop\` (without \`ifExists\`) return \`{ success: false, reason }\` when the event does not exist.
- **Event status**: \`mysql_event_status\` returns \`{ exists: false, name }\` gracefully when the event is not found, instead of throwing an error.
- **Event lifecycle**: Use \`enabled: false\` when creating/testing events. \`onCompletion: "PRESERVE"\` keeps events after expiry.
- **Alter operations**: \`mysql_event_alter\` can enable/disable, change schedule/body, change \`onCompletion\` (PRESERVE/NOT PRESERVE), update comment, or rename (via \`newName\`).
- **Cross-schema**: Both \`mysql_event_list\` and \`mysql_event_status\` accept \`schema\` parameter to query other databases.

## Schema Tools (\`mysql_list_schemas\`, \`mysql_create_view\`, etc.)

- **Schema management**: \`mysql_list_schemas\` lists databases with charset/collation. Use \`pattern\` for LIKE filtering (e.g., \`pattern: "app_%"\`). \`mysql_create_schema\` and \`mysql_drop_schema\` manage databases.
- **Graceful schema errors**: \`mysql_create_schema\` returns \`{ success: false, reason }\` when the schema already exists (without \`ifNotExists\`). \`mysql_drop_schema\` returns \`{ success: false, reason }\` when the schema does not exist (without \`ifExists\`).
- **Views**: \`mysql_create_view\` supports \`orReplace\` (default: false), \`algorithm\` (UNDEFINED/MERGE/TEMPTABLE), and \`checkOption\` (NONE/CASCADED/LOCAL). Returns \`{ success: false, reason }\` when the view already exists without \`orReplace\` or when the SQL definition is invalid (e.g., referencing nonexistent tables). \`mysql_list_views\` shows definitions, security type, and updatability.
- **Constraints**: \`mysql_list_constraints\` returns primary keys, foreign keys, unique, and check constraints. Use \`type\` parameter to filter (e.g., \`type: "FOREIGN KEY"\`). Returns \`{ exists: false, table }\` when the table does not exist.
- **Introspection**: \`mysql_list_stored_procedures\`, \`mysql_list_functions\`, \`mysql_list_triggers\`, \`mysql_list_events\` enumerate database objects. All accept optional \`schema\` parameter for cross-database inspection.

## Sys Schema Tools (\`mysql_sys_*\`)

- **User/Host activity**: \`mysql_sys_user_summary\` and \`mysql_sys_host_summary\` show connection counts, statement latency, and I/O metrics. Filter with \`user\` or \`host\` parameters.
- **Statement analysis**: \`mysql_sys_statement_summary\` returns query digest stats (default \`limit: 20\`). Order by \`total_latency\` (default), \`exec_count\`, \`avg_latency\`, \`rows_sent\`, or \`rows_examined\`.
- **I/O analysis**: \`mysql_sys_io_summary\` supports \`table\` (default), \`file\`, and \`global\` types for I/O breakdown (default \`limit: 20\`).
- **Wait events**: \`mysql_sys_wait_summary\` supports \`global\` (default), \`by_host\`, \`by_user\`, and \`by_instance\` types for wait analysis. The \`by_instance\` type provides per-instance granularity from \`performance_schema\` with formatted latencies.
- **Lock contention**: \`mysql_sys_innodb_lock_waits\` shows active lock waits. Returns \`hasContention: false\` when none.
- **Memory usage**: \`mysql_sys_memory_summary\` returns \`globalMemory\` (by event type) and \`memoryByUser\` arrays. The \`limit\` parameter (default 20) applies to both arrays.
- **Schema stats**: \`mysql_sys_schema_stats\` returns 3 arrays: \`tableStatistics\` (DML and I/O per table), \`indexStatistics\` (per-index usage), and \`autoIncrementStatus\` (usage ratios). Filter by \`schema\` (defaults to current database). The \`limit\` parameter (default 20) applies per array.

## Stats Tools (\`mysql_stats_*\`)

- **Descriptive statistics**: \`mysql_stats_descriptive\` returns mean, median, stddev, min, max, count for numeric columns. Supports \`where\` filtering.
- **Percentiles**: \`mysql_stats_percentiles\` calculates custom percentile values (default: p25, p50, p75, p90, p95, p99).
- **Correlation**: \`mysql_stats_correlation\` calculates Pearson correlation between two numeric columns with interpretation.
- **Distribution**: \`mysql_stats_distribution\` analyzes value distribution with configurable histogram buckets.
- **Time series**: \`mysql_stats_time_series\` aggregates data by time intervals (minute/hour/day/week/month) with sum/avg/count/min/max.
- **Regression**: \`mysql_stats_regression\` performs simple linear regression (y = mx + b) with R² fit analysis.
- **Sampling**: \`mysql_stats_sampling\` returns random rows. Use \`seed\` for reproducibility, \`columns\` to limit output.
- **Histogram**: \`mysql_stats_histogram\` views MySQL 8.0+ optimizer histogram statistics. Use \`update: true\` to create/refresh. Returns \`{ exists: false, table }\` when the table does not exist, and \`{ exists: false, column, table, message }\` when the column does not exist on the table.
- **Error handling**: All stats tools return \`{ exists: false, table }\` gracefully when the table does not exist, and \`{ success: false, error }\` for other query errors (e.g., unknown column). No raw MySQL errors are thrown.

## Security Tools (\`mysql_security_*\`)

- **SSL status**: \`mysql_security_ssl_status\` returns SSL/TLS connection status, cipher, certificate paths, and session statistics.
- **Encryption status**: \`mysql_security_encryption_status\` checks TDE availability, keyring plugins, encrypted tablespaces, and encryption settings.
- **Password validation**: \`mysql_security_password_validate\` uses MySQL \`validate_password\` component to check password strength (0-100 scale). Returns \`available: false\` if component not installed.
- **Data masking**: \`mysql_security_mask_data\` masks sensitive data. Types: \`email\` (preserves domain), \`phone\` (shows last 4), \`ssn\` (shows last 4), \`credit_card\` (shows first/last 4), \`partial\` (uses \`keepFirst\`/\`keepLast\`).
- **User privileges**: \`mysql_security_user_privileges\` returns comprehensive user privilege report. Filter with \`user\` parameter to reduce payload. Use \`summary: true\` for condensed output (privilege counts instead of raw GRANT strings). Summary mode caps \`globalPrivileges\` at 10 entries and includes \`totalGlobalPrivileges\` for the full count.
- **Sensitive tables**: \`mysql_security_sensitive_tables\` identifies columns matching sensitive patterns (password, email, ssn, etc.). Use \`schema\` parameter to limit scope.
- **Enterprise features**: \`mysql_security_audit\`, \`mysql_security_firewall_status\`, \`mysql_security_firewall_rules\` report availability and suggest installation for MySQL Enterprise Edition.

## ProxySQL Tools (\`mysql_proxysql_*\`)

- **Prerequisites**: ProxySQL must be running with admin interface accessible (default port 6032, user/password: admin/admin or as configured via \`PROXYSQL_*\` env vars).
- **Status monitoring**: \`proxysql_status\` returns global status variables. Use \`summary: true\` for key metrics only (uptime, queries, connections).
- **Global variables**: \`proxysql_global_variables\` supports \`prefix\` filter (\`mysql\`, \`admin\`, or \`all\`) and \`like\` pattern for variable name matching.
- **Backend servers**: \`proxysql_servers\` and \`proxysql_connection_pool\` show backend MySQL server configurations and connection pool stats. Filter with \`hostgroup_id\`.
- **Query analysis**: \`proxysql_query_rules\` lists routing rules; \`proxysql_query_digest\` shows top queries by execution count.
- **Admin commands**: \`proxysql_commands\` executes LOAD/SAVE for users, servers, query rules, variables, and FLUSH operations.
- **Memory/Process**: \`proxysql_memory_stats\` shows memory allocation; \`proxysql_process_list\` shows active client sessions.

## MySQL Shell Tools (\`mysqlsh_*\`)

- **Prerequisites**: MySQL Shell must be installed and accessible via \`MYSQLSH_PATH\` environment variable or system PATH.
- **Version check**: \`mysqlsh_version\` verifies MySQL Shell availability before running other shell tools.
- **Upgrade checking**: \`mysqlsh_check_upgrade\` analyzes MySQL server for upgrade compatibility issues. Returns \`errorCount\`, \`warningCount\`, and \`noticeCount\` summary with full JSON report. **Note**: Throws an error when \`targetVersion\` is lower than the current server version (no downgrade analysis is possible).
- **Script execution**: \`mysqlsh_run_script\` supports JavaScript (\`js\`), Python (\`py\`), and SQL (\`sql\`) languages with full access to MySQL Shell APIs. SQL scripts support comments and multi-statement syntax.
- **Table export**: \`mysqlsh_export_table\` uses \`util.exportTable()\` for CSV or TSV export. Use \`where\` parameter for filtered exports. Returns structured error for privilege issues.
- **Parallel import**: \`mysqlsh_import_table\` uses \`util.importTable()\` for high-performance parallel import. **Important**: For CSV files, explicitly set \`fieldsTerminatedBy: ","\` as the delimiter is not auto-detected. Requires \`local_infile\` enabled on server (use \`updateServerSettings: true\` to auto-enable). Use \`skipRows: 1\` to skip header row. The \`columns\` parameter maps input fields **by position** to the specified table columns. **Note**: On InnoDB Cluster (Group Replication), target tables must have a PRIMARY KEY.
- **JSON import**: \`mysqlsh_import_json\` uses \`util.importJson()\` for document import. Supports both NDJSON (one JSON object per line) and multi-line JSON objects. **Does NOT support JSON arrays.** **Requires X Protocol (port 33060)**.
- **Dump utilities**: \`mysqlsh_dump_instance\`, \`mysqlsh_dump_schemas\`, \`mysqlsh_dump_tables\` create compressed parallel dumps. Use \`dryRun: true\` to preview. All dump tools return structured error messages for privilege issues with actionable guidance.
- **Load utility**: \`mysqlsh_load_dump\` restores dumps. Requires \`local_infile\` enabled or \`updateServerSettings: true\`.
- **Privilege note**: Dump operations may require EVENT, TRIGGER, or ROUTINE privileges. Use \`ddlOnly: true\` (schemas) or \`all: false\` (tables) to skip restricted metadata.
`;

/**
 * Generate dynamic instructions based on enabled tools, resources, and prompts
 */
export function generateInstructions(
  enabledTools: Set<string>,
  resources: ResourceDefinition[],
  prompts: PromptDefinition[],
): string {
  let instructions = BASE_INSTRUCTIONS;

  // Add active tools section
  const activeGroups = getActiveToolGroups(enabledTools);
  if (activeGroups.length > 0) {
    instructions += "\n## Active Tools\n\n";
    instructions += `This server instance has ${enabledTools.size} tools enabled across ${activeGroups.length} groups: \n\n`;

    for (const { group, tools } of activeGroups) {
      instructions += `### ${group} (${tools.length} tools) \n`;
      instructions += tools.map((t) => `- \`${t}\``).join("\n");
      instructions += "\n\n";
    }
  }

  // Add resources section
  if (resources.length > 0) {
    instructions += `## Active Resources (${resources.length})\n\n`;
    instructions += "Read-only resources for database metadata:\n\n";
    for (const resource of resources) {
      instructions += `- \`${resource.uri}\` - ${resource.description}\n`;
    }
    instructions += "\n";
  }

  // Add prompts section
  if (prompts.length > 0) {
    instructions += `## Active Prompts (${prompts.length})\n\n`;
    instructions += "Pre-built query templates and guided workflows:\n\n";
    for (const prompt of prompts) {
      instructions += `- \`${prompt.name}\` - ${prompt.description}\n`;
    }
    instructions += "\n";
  }

  return instructions;
}

/**
 * Get active tool groups with their enabled tools
 */
function getActiveToolGroups(
  enabledTools: Set<string>,
): { group: ToolGroup; tools: string[] }[] {
  const activeGroups: { group: ToolGroup; tools: string[] }[] = [];

  for (const [group, allTools] of Object.entries(TOOL_GROUPS) as [
    ToolGroup,
    string[],
  ][]) {
    const enabledInGroup = allTools.filter((tool) => enabledTools.has(tool));
    if (enabledInGroup.length > 0) {
      activeGroups.push({ group, tools: enabledInGroup });
    }
  }

  return activeGroups;
}

/**
 * Static instructions for backward compatibility
 * @deprecated Use generateInstructions() instead for dynamic content
 */
export const SERVER_INSTRUCTIONS = BASE_INSTRUCTIONS;

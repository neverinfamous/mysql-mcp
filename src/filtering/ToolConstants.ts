/**
 * mysql-mcp - Tool Constants
 *
 * Defines the tool groups and meta-groups used for filtering.
 */

import type { ToolGroup, MetaGroup } from "../types/index.js";

/**
 * Default tool groups and their member tools.
 * This serves as the canonical mapping of tools to groups.
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
  core: [
    "mysql_read_query",
    "mysql_write_query",
    "mysql_list_tables",
    "mysql_describe_table",
    "mysql_create_table",
    "mysql_drop_table",
    "mysql_create_index",
    "mysql_get_indexes",
  ],
  json: [
    "mysql_json_extract",
    "mysql_json_set",
    "mysql_json_insert",
    "mysql_json_replace",
    "mysql_json_remove",
    "mysql_json_contains",
    "mysql_json_keys",
    "mysql_json_array_append",
    "mysql_json_get",
    "mysql_json_update",
    "mysql_json_search",
    "mysql_json_validate",
    // Enhanced JSON tools (5 new)
    "mysql_json_merge",
    "mysql_json_diff",
    "mysql_json_normalize",
    "mysql_json_stats",
    "mysql_json_index_suggest",
  ],
  text: [
    "mysql_regexp_match",
    "mysql_like_search",
    "mysql_soundex",
    "mysql_substring",
    "mysql_concat",
    "mysql_collation_convert",
  ],
  fulltext: [
    "mysql_fulltext_create",
    "mysql_fulltext_drop",
    "mysql_fulltext_search",
    "mysql_fulltext_boolean",
    "mysql_fulltext_expand",
  ],
  performance: [
    "mysql_explain",
    "mysql_explain_analyze",
    "mysql_slow_queries",
    "mysql_query_stats",
    "mysql_index_usage",
    "mysql_table_stats",
    "mysql_buffer_pool_stats",
    "mysql_thread_stats",
  ],
  optimization: [
    "mysql_index_recommendation",
    "mysql_query_rewrite",
    "mysql_force_index",
    "mysql_optimizer_trace",
  ],
  admin: [
    "mysql_optimize_table",
    "mysql_analyze_table",
    "mysql_check_table",
    "mysql_repair_table",
    "mysql_flush_tables",
    "mysql_kill_query",
  ],
  monitoring: [
    "mysql_show_processlist",
    "mysql_show_status",
    "mysql_show_variables",
    "mysql_innodb_status",
    "mysql_replication_status",
    "mysql_pool_stats",
    "mysql_server_health",
  ],
  backup: [
    "mysql_export_table",
    "mysql_import_data",
    "mysql_create_dump",
    "mysql_restore_dump",
  ],
  replication: [
    "mysql_master_status",
    "mysql_slave_status",
    "mysql_binlog_events",
    "mysql_gtid_status",
    "mysql_replication_lag",
  ],
  partitioning: [
    "mysql_partition_info",
    "mysql_add_partition",
    "mysql_drop_partition",
    "mysql_reorganize_partition",
  ],
  transactions: [
    "mysql_transaction_begin",
    "mysql_transaction_commit",
    "mysql_transaction_rollback",
    "mysql_transaction_savepoint",
    "mysql_transaction_release",
    "mysql_transaction_rollback_to",
    "mysql_transaction_execute",
  ],
  router: [
    "mysql_router_status",
    "mysql_router_routes",
    "mysql_router_route_status",
    "mysql_router_route_health",
    "mysql_router_route_connections",
    "mysql_router_route_destinations",
    "mysql_router_route_blocked_hosts",
    "mysql_router_metadata_status",
    "mysql_router_pool_status",
  ],
  proxysql: [
    "proxysql_status",
    "proxysql_servers",
    "proxysql_hostgroups",
    "proxysql_query_rules",
    "proxysql_query_digest",
    "proxysql_connection_pool",
    "proxysql_users",
    "proxysql_global_variables",
    "proxysql_runtime_status",
    "proxysql_memory_stats",
    "proxysql_commands",
    "proxysql_process_list",
  ],
  shell: [
    "mysqlsh_version",
    "mysqlsh_check_upgrade",
    "mysqlsh_export_table",
    "mysqlsh_import_table",
    "mysqlsh_import_json",
    "mysqlsh_dump_instance",
    "mysqlsh_dump_schemas",
    "mysqlsh_dump_tables",
    "mysqlsh_load_dump",
    "mysqlsh_run_script",
  ],
  // New tool groups (v2.0.0)
  schema: [
    "mysql_list_schemas",
    "mysql_create_schema",
    "mysql_drop_schema",
    "mysql_list_views",
    "mysql_create_view",
    "mysql_list_stored_procedures",
    "mysql_list_functions",
    "mysql_list_triggers",
    "mysql_list_constraints",
    "mysql_list_events",
  ],
  events: [
    "mysql_event_create",
    "mysql_event_alter",
    "mysql_event_drop",
    "mysql_event_list",
    "mysql_event_status",
    "mysql_scheduler_status",
  ],
  sysschema: [
    "mysql_sys_user_summary",
    "mysql_sys_io_summary",
    "mysql_sys_statement_summary",
    "mysql_sys_wait_summary",
    "mysql_sys_innodb_lock_waits",
    "mysql_sys_schema_stats",
    "mysql_sys_host_summary",
    "mysql_sys_memory_summary",
  ],
  stats: [
    "mysql_stats_descriptive",
    "mysql_stats_percentiles",
    "mysql_stats_correlation",
    "mysql_stats_distribution",
    "mysql_stats_time_series",
    "mysql_stats_regression",
    "mysql_stats_sampling",
    "mysql_stats_histogram",
  ],
  spatial: [
    "mysql_spatial_create_column",
    "mysql_spatial_create_index",
    "mysql_spatial_point",
    "mysql_spatial_polygon",
    "mysql_spatial_distance",
    "mysql_spatial_distance_sphere",
    "mysql_spatial_contains",
    "mysql_spatial_within",
    "mysql_spatial_intersection",
    "mysql_spatial_buffer",
    "mysql_spatial_transform",
    "mysql_spatial_geojson",
  ],
  security: [
    "mysql_security_audit",
    "mysql_security_firewall_status",
    "mysql_security_firewall_rules",
    "mysql_security_mask_data",
    "mysql_security_password_validate",
    "mysql_security_ssl_status",
    "mysql_security_user_privileges",
    "mysql_security_sensitive_tables",
    "mysql_security_encryption_status",
  ],
  cluster: [
    "mysql_gr_status",
    "mysql_gr_members",
    "mysql_gr_primary",
    "mysql_gr_transactions",
    "mysql_gr_flow_control",
    "mysql_cluster_status",
    "mysql_cluster_instances",
    "mysql_cluster_topology",
    "mysql_cluster_router_status",
    "mysql_cluster_switchover",
  ],
  roles: [
    "mysql_role_list",
    "mysql_role_create",
    "mysql_role_drop",
    "mysql_role_grants",
    "mysql_role_grant",
    "mysql_role_assign",
    "mysql_role_revoke",
    "mysql_user_roles",
  ],
  docstore: [
    "mysql_doc_list_collections",
    "mysql_doc_create_collection",
    "mysql_doc_drop_collection",
    "mysql_doc_find",
    "mysql_doc_add",
    "mysql_doc_modify",
    "mysql_doc_remove",
    "mysql_doc_create_index",
    "mysql_doc_collection_info",
  ],
  codemode: ["mysql_execute_code"],
};

/**
 * Meta-groups that expand to multiple tool groups.
 * These provide shortcuts for common use cases.
 *
 * STRICT LIMIT: NO group may exceed 50 tools.
 *
 * Tool counts (verified):
 *   starter:       38
 *   essential:     15
 *   dev-power:     46 (core:8 + schema:10 + performance:8 + stats:8 + fulltext:5 + transactions:7)
 *   ai-data:       45 (core:8 + json:17 + docstore:9 + text:6 + fulltext:5)
 *   ai-spatial:    43 (core:8 + spatial:12 + stats:8 + performance:8 + transactions:7)
 *   dba-monitor:   35 (core:8 + monitoring:7 + performance:8 + sysschema:8 + optimization:4)
 *   dba-manage:    33 (core:8 + admin:6 + backup:4 + replication:5 + partitioning:4 + events:6)
 *   dba-secure:    32 (core:8 + security:9 + roles:8 + transactions:7)
 *   base-core:     48 (core:8 + json:17 + transactions:7 + text:6 + schema:10)
 *   base-advanced: 40 (docstore:9 + spatial:12 + stats:8 + fulltext:5 + events:6)
 *   ecosystem:     41 (router:9 + proxysql:12 + shell:10 + cluster:10)
 */
export const META_GROUPS: Record<MetaGroup, ToolGroup[]> = {
  // 1. General Use
  starter: ["core", "json", "transactions", "text", "codemode"],
  essential: ["core", "transactions", "codemode"],
  "dev-power": [
    "core",
    "schema",
    "performance",
    "stats",
    "fulltext",
    "transactions",
    "codemode",
  ],

  // 2. AI Workloads
  "ai-data": ["core", "json", "docstore", "text", "fulltext", "codemode"],
  "ai-spatial": [
    "core",
    "spatial",
    "stats",
    "performance",
    "transactions",
    "codemode",
  ],

  // 3. DBA Workloads
  "dba-monitor": [
    "core",
    "monitoring",
    "performance",
    "sysschema",
    "optimization",
    "codemode",
  ],
  "dba-manage": [
    "core",
    "admin",
    "backup",
    "replication",
    "partitioning",
    "events",
    "codemode",
  ],
  "dba-secure": ["core", "security", "roles", "transactions", "codemode"],

  // 4. Base Blocks (Building Blocks)
  "base-core": ["core", "json", "transactions", "text", "schema", "codemode"],
  "base-advanced": [
    "docstore",
    "spatial",
    "stats",
    "fulltext",
    "events",
    "codemode",
  ],

  // 5. Ecosystem
  ecosystem: ["router", "proxysql", "shell", "cluster", "codemode"],
};

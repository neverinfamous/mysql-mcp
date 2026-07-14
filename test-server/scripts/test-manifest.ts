import { TestDirectory, TestFileEntry } from './lib/types';

export const TEST_FILES: TestFileEntry[] = [
  {
    "filename": "test-usability-admin-part1.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table",
      "mysql_check_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-admin-part2.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_repair_table",
      "mysql_flush_tables",
      "mysql_kill_query"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-admin-part3.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config",
      "mysql_audit_search"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-events-part1.md",
    "directory": "test-usability",
    "group": "events",
    "tools": [
      "mysql_event_create",
      "mysql_event_alter",
      "mysql_event_drop"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-events-part2.md",
    "directory": "test-usability",
    "group": "events",
    "tools": [
      "mysql_event_list",
      "mysql_event_status",
      "mysql_scheduler_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-introspection-part1.md",
    "directory": "test-usability",
    "group": "introspection",
    "tools": [
      "mysql_dependency_graph",
      "mysql_topological_sort",
      "mysql_cascade_simulator"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-introspection-part2.md",
    "directory": "test-usability",
    "group": "introspection",
    "tools": [
      "mysql_schema_snapshot",
      "mysql_constraint_analysis",
      "mysql_migration_risks"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-migration-part1.md",
    "directory": "test-usability",
    "group": "migration",
    "tools": [
      "mysql_migration_init",
      "mysql_migration_record",
      "mysql_migration_apply"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-migration-part2.md",
    "directory": "test-usability",
    "group": "migration",
    "tools": [
      "mysql_migration_rollback",
      "mysql_migration_history",
      "mysql_migration_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-text-part1.md",
    "directory": "test-usability",
    "group": "text",
    "tools": [
      "mysql_regexp_match",
      "mysql_like_search",
      "mysql_soundex"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-text-part2.md",
    "directory": "test-usability",
    "group": "text",
    "tools": [
      "mysql_substring",
      "mysql_concat",
      "mysql_collation_convert"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-codemode-admin-audit.md",
    "directory": "test-codemode",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config",
      "mysql_audit_search"
    ]
  },
  {
    "filename": "test-codemode-admin-maintenance-part1a.md",
    "directory": "test-codemode",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table",
      "mysql_check_table"
    ]
  },
  {
    "filename": "test-codemode-admin-maintenance-part1b.md",
    "directory": "test-codemode",
    "group": "admin",
    "tools": [
      "mysql_repair_table",
      "mysql_flush_tables",
      "mysql_kill_query"
    ]
  },
  {
    "filename": "test-codemode-backup-audit.md",
    "directory": "test-codemode",
    "group": "backup",
    "tools": [
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup",
      "mysql_audit_diff_backup"
    ]
  },
  {
    "filename": "test-codemode-backup-data-part1.md",
    "directory": "test-codemode",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data"
    ]
  },
  {
    "filename": "test-codemode-backup-data-part2.md",
    "directory": "test-codemode",
    "group": "backup",
    "tools": [
      "mysql_create_dump",
      "mysql_restore_dump"
    ]
  },
  {
    "filename": "test-codemode-cluster-group-replication-part1.md",
    "directory": "test-codemode",
    "group": "cluster",
    "tools": [
      "mysql_gr_status",
      "mysql_gr_members",
      "mysql_gr_primary"
    ]
  },
  {
    "filename": "test-codemode-cluster-group-replication-part2.md",
    "directory": "test-codemode",
    "group": "cluster",
    "tools": [
      "mysql_gr_transactions",
      "mysql_gr_flow_control"
    ]
  },
  {
    "filename": "test-codemode-cluster-innodb-part1.md",
    "directory": "test-codemode",
    "group": "cluster",
    "tools": [
      "mysql_cluster_status",
      "mysql_cluster_instances",
      "mysql_cluster_topology"
    ]
  },
  {
    "filename": "test-codemode-cluster-innodb-part2.md",
    "directory": "test-codemode",
    "group": "cluster",
    "tools": [
      "mysql_cluster_router_status",
      "mysql_cluster_switchover"
    ]
  },
  {
    "filename": "test-codemode-core-read-part1.md",
    "directory": "test-codemode",
    "group": "core-read",
    "tools": [
      "mysql_read_query",
      "mysql_list_tables"
    ]
  },
  {
    "filename": "test-codemode-core-read-part2.md",
    "directory": "test-codemode",
    "group": "core-read",
    "tools": [
      "mysql_describe_table",
      "mysql_get_indexes"
    ]
  },
  {
    "filename": "test-codemode-core-write-part1.md",
    "directory": "test-codemode",
    "group": "core-write",
    "tools": [
      "mysql_write_query",
      "mysql_create_table"
    ]
  },
  {
    "filename": "test-codemode-core-write-part2.md",
    "directory": "test-codemode",
    "group": "core-write",
    "tools": [
      "mysql_drop_table",
      "mysql_create_index"
    ]
  },
  {
    "filename": "test-codemode-docstore-collections-part1.md",
    "directory": "test-codemode",
    "group": "docstore",
    "tools": [
      "mysql_doc_list_collections",
      "mysql_doc_create_collection",
      "mysql_doc_drop_collection"
    ]
  },
  {
    "filename": "test-codemode-docstore-collections-part2.md",
    "directory": "test-codemode",
    "group": "docstore",
    "tools": [
      "mysql_doc_create_index",
      "mysql_doc_collection_info"
    ]
  },
  {
    "filename": "test-codemode-docstore-documents-part1.md",
    "directory": "test-codemode",
    "group": "docstore",
    "tools": [
      "mysql_doc_find",
      "mysql_doc_add"
    ]
  },
  {
    "filename": "test-codemode-docstore-documents-part2.md",
    "directory": "test-codemode",
    "group": "docstore",
    "tools": [
      "mysql_doc_modify",
      "mysql_doc_remove"
    ]
  },
  {
    "filename": "test-codemode-events-part1a.md",
    "directory": "test-codemode",
    "group": "events",
    "tools": [
      "mysql_event_create",
      "mysql_event_alter",
      "mysql_event_drop"
    ]
  },
  {
    "filename": "test-codemode-events-part1b.md",
    "directory": "test-codemode",
    "group": "events",
    "tools": [
      "mysql_event_list",
      "mysql_event_status",
      "mysql_scheduler_status"
    ]
  },
  {
    "filename": "test-codemode-fulltext-part1a.md",
    "directory": "test-codemode",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_create"
    ]
  },
  {
    "filename": "test-codemode-fulltext-part1b.md",
    "directory": "test-codemode",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_drop"
    ]
  },
  {
    "filename": "test-codemode-fulltext-part2a.md",
    "directory": "test-codemode",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_search",
      "mysql_fulltext_boolean",
      "mysql_fulltext_expand"
    ]
  },
  {
    "filename": "test-codemode-introspection-part1a.md",
    "directory": "test-codemode",
    "group": "introspection",
    "tools": [
      "mysql_dependency_graph",
      "mysql_topological_sort",
      "mysql_cascade_simulator"
    ]
  },
  {
    "filename": "test-codemode-introspection-part1b.md",
    "directory": "test-codemode",
    "group": "introspection",
    "tools": [
      "mysql_schema_snapshot",
      "mysql_constraint_analysis",
      "mysql_migration_risks"
    ]
  },
  {
    "filename": "test-codemode-json-core-read.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_extract",
      "mysql_json_contains",
      "mysql_json_keys"
    ]
  },
  {
    "filename": "test-codemode-json-core-write-part1.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_set",
      "mysql_json_insert",
      "mysql_json_replace"
    ]
  },
  {
    "filename": "test-codemode-json-core-write-part2.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_remove",
      "mysql_json_array_append"
    ]
  },
  {
    "filename": "test-codemode-json-enhanced-part1.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff"
    ]
  },
  {
    "filename": "test-codemode-json-enhanced-part2.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_normalize",
      "mysql_json_stats",
      "mysql_json_index_suggest"
    ]
  },
  {
    "filename": "test-codemode-json-helpers-part1.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_get",
      "mysql_json_update"
    ]
  },
  {
    "filename": "test-codemode-json-helpers-part2.md",
    "directory": "test-codemode",
    "group": "json",
    "tools": [
      "mysql_json_search",
      "mysql_json_validate"
    ]
  },
  {
    "filename": "test-codemode-migration-part1a.md",
    "directory": "test-codemode",
    "group": "migration",
    "tools": [
      "mysql_migration_init",
      "mysql_migration_record",
      "mysql_migration_apply"
    ]
  },
  {
    "filename": "test-codemode-migration-part1b.md",
    "directory": "test-codemode",
    "group": "migration",
    "tools": [
      "mysql_migration_rollback",
      "mysql_migration_history",
      "mysql_migration_status"
    ]
  },
  {
    "filename": "test-codemode-monitoring-part1a.md",
    "directory": "test-codemode",
    "group": "monitoring",
    "tools": [
      "mysql_show_processlist",
      "mysql_show_status"
    ]
  },
  {
    "filename": "test-codemode-monitoring-part1b.md",
    "directory": "test-codemode",
    "group": "monitoring",
    "tools": [
      "mysql_show_variables",
      "mysql_innodb_status"
    ]
  },
  {
    "filename": "test-codemode-monitoring-part2a.md",
    "directory": "test-codemode",
    "group": "monitoring",
    "tools": [
      "mysql_replication_status",
      "mysql_pool_stats",
      "mysql_server_health"
    ]
  },
  {
    "filename": "test-codemode-optimization-part1.md",
    "directory": "test-codemode",
    "group": "optimization",
    "tools": [
      "mysql_index_recommendation",
      "mysql_query_rewrite"
    ]
  },
  {
    "filename": "test-codemode-optimization-part2.md",
    "directory": "test-codemode",
    "group": "optimization",
    "tools": [
      "mysql_force_index",
      "mysql_optimizer_trace"
    ]
  },
  {
    "filename": "test-codemode-partitioning-part1.md",
    "directory": "test-codemode",
    "group": "partitioning",
    "tools": [
      "mysql_partition_info",
      "mysql_add_partition"
    ]
  },
  {
    "filename": "test-codemode-partitioning-part2.md",
    "directory": "test-codemode",
    "group": "partitioning",
    "tools": [
      "mysql_drop_partition",
      "mysql_reorganize_partition"
    ]
  },
  {
    "filename": "test-codemode-performance-analysis-queries-part1.md",
    "directory": "test-codemode",
    "group": "performance",
    "tools": [
      "mysql_explain",
      "mysql_explain_analyze"
    ]
  },
  {
    "filename": "test-codemode-performance-analysis-queries-part2.md",
    "directory": "test-codemode",
    "group": "performance",
    "tools": [
      "mysql_slow_queries",
      "mysql_query_stats"
    ]
  },
  {
    "filename": "test-codemode-performance-analysis-system-part1.md",
    "directory": "test-codemode",
    "group": "performance",
    "tools": [
      "mysql_index_usage",
      "mysql_table_stats"
    ]
  },
  {
    "filename": "test-codemode-performance-analysis-system-part2a.md",
    "directory": "test-codemode",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats"
    ]
  },
  {
    "filename": "test-codemode-performance-anomaly.md",
    "directory": "test-codemode",
    "group": "performance",
    "tools": [
      "mysql_detect_query_anomalies",
      "mysql_detect_bloat_risk",
      "mysql_detect_connection_spike"
    ]
  },
  {
    "filename": "test-codemode-proxysql-config-part1.md",
    "directory": "test-codemode",
    "group": "proxysql",
    "tools": [
      "proxysql_query_rules",
      "proxysql_users"
    ]
  },
  {
    "filename": "test-codemode-proxysql-config-part2.md",
    "directory": "test-codemode",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_commands"
    ]
  },
  {
    "filename": "test-codemode-proxysql-status-part1a.md",
    "directory": "test-codemode",
    "group": "proxysql",
    "tools": [
      "proxysql_status",
      "proxysql_servers"
    ]
  },
  {
    "filename": "test-codemode-proxysql-status-part1b.md",
    "directory": "test-codemode",
    "group": "proxysql",
    "tools": [
      "proxysql_connection_pool",
      "proxysql_runtime_status"
    ]
  },
  {
    "filename": "test-codemode-proxysql-status-part2a.md",
    "directory": "test-codemode",
    "group": "proxysql",
    "tools": [
      "proxysql_memory_stats",
      "proxysql_process_list",
      "proxysql_query_digest"
    ]
  },
  {
    "filename": "test-codemode-replication-part1.md",
    "directory": "test-codemode",
    "group": "replication",
    "tools": [
      "mysql_master_status",
      "mysql_slave_status",
      "mysql_binlog_events"
    ]
  },
  {
    "filename": "test-codemode-replication-part2.md",
    "directory": "test-codemode",
    "group": "replication",
    "tools": [
      "mysql_gtid_status",
      "mysql_replication_lag"
    ]
  },
  {
    "filename": "test-codemode-roles-grants-part1.md",
    "directory": "test-codemode",
    "group": "roles",
    "tools": [
      "mysql_role_grants",
      "mysql_role_grant"
    ]
  },
  {
    "filename": "test-codemode-roles-grants-part2.md",
    "directory": "test-codemode",
    "group": "roles",
    "tools": [
      "mysql_role_assign",
      "mysql_role_revoke"
    ]
  },
  {
    "filename": "test-codemode-roles-management-part1.md",
    "directory": "test-codemode",
    "group": "roles",
    "tools": [
      "mysql_role_list",
      "mysql_role_create"
    ]
  },
  {
    "filename": "test-codemode-roles-management-part2.md",
    "directory": "test-codemode",
    "group": "roles",
    "tools": [
      "mysql_role_drop",
      "mysql_user_roles"
    ]
  },
  {
    "filename": "test-codemode-router-core-part1.md",
    "directory": "test-codemode",
    "group": "router",
    "tools": [
      "mysql_router_status",
      "mysql_router_routes"
    ]
  },
  {
    "filename": "test-codemode-router-core-part2.md",
    "directory": "test-codemode",
    "group": "router",
    "tools": [
      "mysql_router_metadata_status",
      "mysql_router_pool_status"
    ]
  },
  {
    "filename": "test-codemode-router-routes-part1.md",
    "directory": "test-codemode",
    "group": "router",
    "tools": [
      "mysql_router_route_status",
      "mysql_router_route_health",
      "mysql_router_route_connections"
    ]
  },
  {
    "filename": "test-codemode-router-routes-part2.md",
    "directory": "test-codemode",
    "group": "router",
    "tools": [
      "mysql_router_route_destinations",
      "mysql_router_route_blocked_hosts"
    ]
  },
  {
    "filename": "test-codemode-schema-management-part1a.md",
    "directory": "test-codemode",
    "group": "schema",
    "tools": [
      "mysql_list_schemas",
      "mysql_create_schema"
    ]
  },
  {
    "filename": "test-codemode-schema-management-part1b.md",
    "directory": "test-codemode",
    "group": "schema",
    "tools": [
      "mysql_drop_schema",
      "mysql_list_views"
    ]
  },
  {
    "filename": "test-codemode-schema-management-part2a.md",
    "directory": "test-codemode",
    "group": "schema",
    "tools": [
      "mysql_create_view",
      "mysql_drop_view",
      "mysql_list_constraints"
    ]
  },
  {
    "filename": "test-codemode-schema-routines-part1.md",
    "directory": "test-codemode",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions",
      "mysql_list_triggers"
    ]
  },
  {
    "filename": "test-codemode-schema-routines-part2.md",
    "directory": "test-codemode",
    "group": "schema",
    "tools": [
      "mysql_create_trigger",
      "mysql_drop_trigger"
    ]
  },
  {
    "filename": "test-codemode-security-audit-part1.md",
    "directory": "test-codemode",
    "group": "security",
    "tools": [
      "mysql_security_audit",
      "mysql_security_mask_data"
    ]
  },
  {
    "filename": "test-codemode-security-audit-part2.md",
    "directory": "test-codemode",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables"
    ]
  },
  {
    "filename": "test-codemode-security-firewall-part1.md",
    "directory": "test-codemode",
    "group": "security",
    "tools": [
      "mysql_security_firewall_status",
      "mysql_security_firewall_rules"
    ]
  },
  {
    "filename": "test-codemode-security-firewall-part2.md",
    "directory": "test-codemode",
    "group": "security",
    "tools": [
      "mysql_security_ssl_status",
      "mysql_security_encryption_status",
      "mysql_security_password_validate"
    ]
  },
  {
    "filename": "test-codemode-shell-data-part1a.md",
    "directory": "test-codemode",
    "group": "shell",
    "tools": [
      "mysqlsh_version",
      "mysqlsh_check_upgrade"
    ]
  },
  {
    "filename": "test-codemode-shell-data-part1b.md",
    "directory": "test-codemode",
    "group": "shell",
    "tools": [
      "mysqlsh_export_table",
      "mysqlsh_import_table"
    ]
  },
  {
    "filename": "test-codemode-shell-data-part2a.md",
    "directory": "test-codemode",
    "group": "shell",
    "tools": [
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ]
  },
  {
    "filename": "test-codemode-shell-data-part2b.md",
    "directory": "test-codemode",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables"
    ]
  },
  {
    "filename": "test-codemode-shell-utils.md",
    "directory": "test-codemode",
    "group": "shell",
    "tools": [
      "mysqlsh_load_dump",
      "mysqlsh_run_script"
    ]
  },
  {
    "filename": "test-codemode-spatial-geometry.md",
    "directory": "test-codemode",
    "group": "spatial",
    "tools": [
      "mysql_spatial_point",
      "mysql_spatial_polygon"
    ]
  },
  {
    "filename": "test-codemode-spatial-operations-part1.md",
    "directory": "test-codemode",
    "group": "spatial",
    "tools": [
      "mysql_spatial_intersection",
      "mysql_spatial_buffer"
    ]
  },
  {
    "filename": "test-codemode-spatial-operations-part2.md",
    "directory": "test-codemode",
    "group": "spatial",
    "tools": [
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ]
  },
  {
    "filename": "test-codemode-spatial-queries-part1.md",
    "directory": "test-codemode",
    "group": "spatial",
    "tools": [
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ]
  },
  {
    "filename": "test-codemode-spatial-queries-part2.md",
    "directory": "test-codemode",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within"
    ]
  },
  {
    "filename": "test-codemode-spatial-setup.md",
    "directory": "test-codemode",
    "group": "spatial",
    "tools": [
      "mysql_spatial_create_column",
      "mysql_spatial_create_index"
    ]
  },
  {
    "filename": "test-codemode-stats-advanced-part1a.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_hypothesis",
      "mysql_stats_outliers",
      "mysql_stats_top_n"
    ]
  },
  {
    "filename": "test-codemode-stats-advanced-part1b.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_distinct",
      "mysql_stats_frequency",
      "mysql_stats_summary"
    ]
  },
  {
    "filename": "test-codemode-stats-analytics.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_correlation",
      "mysql_stats_time_series",
      "mysql_stats_regression"
    ]
  },
  {
    "filename": "test-codemode-stats-basic-part1.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles",
      "mysql_stats_distribution"
    ]
  },
  {
    "filename": "test-codemode-stats-basic-part2.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram"
    ]
  },
  {
    "filename": "test-codemode-stats-window-part1a.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_row_number",
      "mysql_stats_rank",
      "mysql_stats_lag_lead"
    ]
  },
  {
    "filename": "test-codemode-stats-window-part1b.md",
    "directory": "test-codemode",
    "group": "stats",
    "tools": [
      "mysql_stats_running_total",
      "mysql_stats_moving_avg",
      "mysql_stats_ntile"
    ]
  },
  {
    "filename": "test-codemode-sys-analysis-part1.md",
    "directory": "test-codemode",
    "group": "sysschema",
    "tools": [
      "mysql_sys_statement_summary",
      "mysql_sys_wait_summary"
    ]
  },
  {
    "filename": "test-codemode-sys-analysis-part2.md",
    "directory": "test-codemode",
    "group": "sysschema",
    "tools": [
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ]
  },
  {
    "filename": "test-codemode-sys-metrics-part1.md",
    "directory": "test-codemode",
    "group": "sysschema",
    "tools": [
      "mysql_sys_user_summary",
      "mysql_sys_io_summary"
    ]
  },
  {
    "filename": "test-codemode-sys-metrics-part2.md",
    "directory": "test-codemode",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ]
  },
  {
    "filename": "test-codemode-text-part1a.md",
    "directory": "test-codemode",
    "group": "text",
    "tools": [
      "mysql_regexp_match",
      "mysql_like_search",
      "mysql_soundex"
    ]
  },
  {
    "filename": "test-codemode-text-part1b.md",
    "directory": "test-codemode",
    "group": "text",
    "tools": [
      "mysql_substring",
      "mysql_concat",
      "mysql_collation_convert"
    ]
  },
  {
    "filename": "test-codemode-transactions-part1a.md",
    "directory": "test-codemode",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit"
    ]
  },
  {
    "filename": "test-codemode-transactions-part1b.md",
    "directory": "test-codemode",
    "group": "transactions",
    "tools": [
      "mysql_transaction_rollback",
      "mysql_transaction_savepoint"
    ]
  },
  {
    "filename": "test-codemode-transactions-part2a.md",
    "directory": "test-codemode",
    "group": "transactions",
    "tools": [
      "mysql_transaction_release",
      "mysql_transaction_rollback_to",
      "mysql_transaction_execute"
    ]
  },
  {
    "filename": "test-codemode-vector-management-part1.md",
    "directory": "test-codemode",
    "group": "vector",
    "tools": [
      "mysql_vector_info",
      "mysql_vector_create_index"
    ]
  },
  {
    "filename": "test-codemode-vector-management-part2.md",
    "directory": "test-codemode",
    "group": "vector",
    "tools": [
      "mysql_vector_optimize",
      "mysql_vector_stats"
    ]
  },
  {
    "filename": "test-codemode-vector-search.md",
    "directory": "test-codemode",
    "group": "vector",
    "tools": [
      "mysql_vector_search",
      "mysql_vector_range_search",
      "mysql_vector_hybrid_search"
    ]
  },
  {
    "filename": "test-codemode-vector-storage-part1.md",
    "directory": "test-codemode",
    "group": "vector",
    "tools": [
      "mysql_vector_store",
      "mysql_vector_batch_store"
    ]
  },
  {
    "filename": "test-codemode-vector-storage-part2.md",
    "directory": "test-codemode",
    "group": "vector",
    "tools": [
      "mysql_vector_delete",
      "mysql_vector_get"
    ]
  },
  {
    "filename": "test-codemode-versioning-part1.md",
    "directory": "test-codemode",
    "group": "versioning",
    "tools": [
      "mysql_enable_versioning",
      "mysql_disable_versioning"
    ]
  },
  {
    "filename": "test-codemode-versioning-part2.md",
    "directory": "test-codemode",
    "group": "versioning",
    "tools": [
      "mysql_check_version",
      "mysql_conditional_update"
    ]
  },
  {
    "filename": "test-codemode-advanced-concurrency.md",
    "directory": "test-advanced",
    "group": "codemode",
    "tools": [
      "mysql_execute_code"
    ],
    "contentPartial": "test-codemode-advanced-concurrency.content.md"
  },
  {
    "filename": "test-codemode-advanced-types-binary.md",
    "directory": "test-advanced",
    "group": "codemode",
    "tools": [
      "mysql_execute_code"
    ],
    "contentPartial": "test-codemode-advanced-types-binary.content.md"
  },
  {
    "filename": "test-codemode-advanced-types-date.md",
    "directory": "test-advanced",
    "group": "codemode",
    "tools": [
      "mysql_execute_code"
    ],
    "contentPartial": "test-codemode-advanced-types-date.content.md"
  },
  {
    "filename": "test-codemode-advanced-types-json.md",
    "directory": "test-advanced",
    "group": "codemode",
    "tools": [
      "mysql_execute_code"
    ],
    "contentPartial": "test-codemode-advanced-types-json.content.md"
  },
  {
    "filename": "test-usability-backup-part1.md",
    "directory": "test-usability",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data",
      "mysql_create_dump"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-backup-part2.md",
    "directory": "test-usability",
    "group": "backup",
    "tools": [
      "mysql_restore_dump",
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-backup-part3.md",
    "directory": "test-usability",
    "group": "backup",
    "tools": [
      "mysql_audit_diff_backup"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part1.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_gr_status",
      "mysql_gr_members",
      "mysql_gr_primary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part2.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_gr_transactions",
      "mysql_gr_flow_control",
      "mysql_cluster_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part3.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_cluster_instances",
      "mysql_cluster_topology",
      "mysql_cluster_router_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part4.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_cluster_switchover"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part1.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_read_query",
      "mysql_write_query",
      "mysql_list_tables"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part2.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_describe_table",
      "mysql_create_table",
      "mysql_drop_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part3.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_create_index",
      "mysql_get_indexes",
      "mysql_enable_versioning"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part4.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_disable_versioning",
      "mysql_check_version",
      "mysql_conditional_update"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part1.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
      "mysql_doc_list_collections",
      "mysql_doc_create_collection",
      "mysql_doc_drop_collection"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part2.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
      "mysql_doc_find",
      "mysql_doc_add",
      "mysql_doc_modify"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part3.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
      "mysql_doc_remove",
      "mysql_doc_create_index",
      "mysql_doc_collection_info"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-fulltext-part1.md",
    "directory": "test-usability",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_create",
      "mysql_fulltext_drop",
      "mysql_fulltext_search"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-fulltext-part2.md",
    "directory": "test-usability",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_boolean",
      "mysql_fulltext_expand"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part1.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_extract",
      "mysql_json_set",
      "mysql_json_insert"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part2.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_replace",
      "mysql_json_remove",
      "mysql_json_contains"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part3.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_keys",
      "mysql_json_array_append",
      "mysql_json_get"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part4.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_update",
      "mysql_json_search",
      "mysql_json_validate"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part5.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff",
      "mysql_json_normalize"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part6.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_stats",
      "mysql_json_index_suggest"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-monitoring-part1.md",
    "directory": "test-usability",
    "group": "monitoring",
    "tools": [
      "mysql_show_processlist",
      "mysql_show_status",
      "mysql_show_variables"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-monitoring-part2.md",
    "directory": "test-usability",
    "group": "monitoring",
    "tools": [
      "mysql_innodb_status",
      "mysql_replication_status",
      "mysql_pool_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-monitoring-part3.md",
    "directory": "test-usability",
    "group": "monitoring",
    "tools": [
      "mysql_server_health"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-optimization-part1.md",
    "directory": "test-usability",
    "group": "optimization",
    "tools": [
      "mysql_index_recommendation",
      "mysql_query_rewrite",
      "mysql_force_index"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-optimization-part2.md",
    "directory": "test-usability",
    "group": "optimization",
    "tools": [
      "mysql_optimizer_trace"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-partitioning-part1.md",
    "directory": "test-usability",
    "group": "partitioning",
    "tools": [
      "mysql_partition_info",
      "mysql_add_partition",
      "mysql_drop_partition"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-partitioning-part2.md",
    "directory": "test-usability",
    "group": "partitioning",
    "tools": [
      "mysql_reorganize_partition"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part1.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_explain",
      "mysql_explain_analyze",
      "mysql_slow_queries"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part2.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_query_stats",
      "mysql_index_usage",
      "mysql_table_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part3.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats",
      "mysql_detect_query_anomalies"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part4.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_detect_bloat_risk",
      "mysql_detect_connection_spike"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part1.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_status",
      "proxysql_servers",
      "proxysql_query_rules"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part2.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_query_digest",
      "proxysql_connection_pool",
      "proxysql_users"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part3.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_runtime_status",
      "proxysql_memory_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part4.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_commands",
      "proxysql_process_list"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-replication-part1.md",
    "directory": "test-usability",
    "group": "replication",
    "tools": [
      "mysql_master_status",
      "mysql_slave_status",
      "mysql_binlog_events"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-replication-part2.md",
    "directory": "test-usability",
    "group": "replication",
    "tools": [
      "mysql_gtid_status",
      "mysql_replication_lag"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-roles-part1.md",
    "directory": "test-usability",
    "group": "roles",
    "tools": [
      "mysql_role_list",
      "mysql_role_create",
      "mysql_role_drop"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-roles-part2.md",
    "directory": "test-usability",
    "group": "roles",
    "tools": [
      "mysql_role_grants",
      "mysql_role_grant",
      "mysql_role_assign"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-roles-part3.md",
    "directory": "test-usability",
    "group": "roles",
    "tools": [
      "mysql_role_revoke",
      "mysql_user_roles"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part1.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
      "mysql_router_status",
      "mysql_router_routes",
      "mysql_router_route_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part2.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
      "mysql_router_route_health",
      "mysql_router_route_connections",
      "mysql_router_route_destinations"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part3.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
      "mysql_router_route_blocked_hosts",
      "mysql_router_metadata_status",
      "mysql_router_pool_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part1.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_list_schemas",
      "mysql_create_schema",
      "mysql_drop_schema"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part2.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_list_views",
      "mysql_create_view",
      "mysql_drop_view"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part3.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions",
      "mysql_list_triggers"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part4.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_create_trigger",
      "mysql_drop_trigger",
      "mysql_list_constraints"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part1.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
      "mysql_security_audit",
      "mysql_security_firewall_status",
      "mysql_security_firewall_rules"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part2.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
      "mysql_security_mask_data",
      "mysql_security_password_validate",
      "mysql_security_ssl_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part3.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables",
      "mysql_security_encryption_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part1.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_version",
      "mysqlsh_check_upgrade",
      "mysqlsh_export_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part2.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_import_table",
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part3.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables",
      "mysqlsh_load_dump"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part4.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_run_script"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part1.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_create_column",
      "mysql_spatial_create_index",
      "mysql_spatial_point"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part2.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_polygon",
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part3.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within",
      "mysql_spatial_intersection"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part4.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_buffer",
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part1.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles",
      "mysql_stats_correlation"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part2.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_distribution",
      "mysql_stats_time_series",
      "mysql_stats_regression"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part3.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram",
      "mysql_stats_row_number"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part4.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_rank",
      "mysql_stats_lag_lead",
      "mysql_stats_running_total"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part5.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_moving_avg",
      "mysql_stats_ntile",
      "mysql_stats_hypothesis"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part6.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_outliers",
      "mysql_stats_top_n",
      "mysql_stats_distinct"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part7.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_frequency",
      "mysql_stats_summary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-sysschema-part1.md",
    "directory": "test-usability",
    "group": "sysschema",
    "tools": [
      "mysql_sys_user_summary",
      "mysql_sys_io_summary",
      "mysql_sys_statement_summary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-sysschema-part2.md",
    "directory": "test-usability",
    "group": "sysschema",
    "tools": [
      "mysql_sys_wait_summary",
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-sysschema-part3.md",
    "directory": "test-usability",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-transactions-part1.md",
    "directory": "test-usability",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit",
      "mysql_transaction_rollback"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-transactions-part2.md",
    "directory": "test-usability",
    "group": "transactions",
    "tools": [
      "mysql_transaction_savepoint",
      "mysql_transaction_release",
      "mysql_transaction_rollback_to"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-transactions-part3.md",
    "directory": "test-usability",
    "group": "transactions",
    "tools": [
      "mysql_transaction_execute"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part1.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_store",
      "mysql_vector_batch_store",
      "mysql_vector_delete"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part2.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_get",
      "mysql_vector_search",
      "mysql_vector_range_search"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part3.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_hybrid_search",
      "mysql_vector_info",
      "mysql_vector_create_index"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part4.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_optimize",
      "mysql_vector_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-admin-part1.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table",
      "mysql_check_table"
    ]
  },
  {
    "filename": "test-usability-direct-admin-part2.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_repair_table",
      "mysql_flush_tables",
      "mysql_kill_query"
    ]
  },
  {
    "filename": "test-usability-direct-admin-part3.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config",
      "mysql_audit_search"
    ]
  },
  {
    "filename": "test-usability-direct-backup-part1.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data",
      "mysql_create_dump"
    ]
  },
  {
    "filename": "test-usability-direct-backup-part2.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_restore_dump",
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup"
    ]
  },
  {
    "filename": "test-usability-direct-backup-part3.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_audit_diff_backup"
    ]
  },
  {
    "filename": "test-usability-direct-cluster-part1.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_gr_status",
      "mysql_gr_members",
      "mysql_gr_primary"
    ]
  },
  {
    "filename": "test-usability-direct-cluster-part2.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_gr_transactions",
      "mysql_gr_flow_control",
      "mysql_cluster_status"
    ]
  },
  {
    "filename": "test-usability-direct-cluster-part3.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_cluster_instances",
      "mysql_cluster_topology",
      "mysql_cluster_router_status"
    ]
  },
  {
    "filename": "test-usability-direct-cluster-part4.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_cluster_switchover"
    ]
  },
  {
    "filename": "test-usability-direct-core-part1.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_read_query",
      "mysql_write_query",
      "mysql_list_tables"
    ]
  },
  {
    "filename": "test-usability-direct-core-part2.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_describe_table",
      "mysql_create_table",
      "mysql_drop_table"
    ]
  },
  {
    "filename": "test-usability-direct-core-part3.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_create_index",
      "mysql_get_indexes",
      "mysql_enable_versioning"
    ]
  },
  {
    "filename": "test-usability-direct-core-part4.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_disable_versioning",
      "mysql_check_version",
      "mysql_conditional_update"
    ]
  },
  {
    "filename": "test-usability-direct-docstore-part1.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_list_collections",
      "mysql_doc_create_collection",
      "mysql_doc_drop_collection"
    ]
  },
  {
    "filename": "test-usability-direct-docstore-part2.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_find",
      "mysql_doc_add",
      "mysql_doc_modify"
    ]
  },
  {
    "filename": "test-usability-direct-docstore-part3.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_remove",
      "mysql_doc_create_index",
      "mysql_doc_collection_info"
    ]
  },
  {
    "filename": "test-usability-direct-events-part1.md",
    "directory": "test-usability-direct",
    "group": "events",
    "tools": [
      "mysql_event_create",
      "mysql_event_alter",
      "mysql_event_drop"
    ]
  },
  {
    "filename": "test-usability-direct-events-part2.md",
    "directory": "test-usability-direct",
    "group": "events",
    "tools": [
      "mysql_event_list",
      "mysql_event_status",
      "mysql_scheduler_status"
    ]
  },
  {
    "filename": "test-usability-direct-fulltext-part1.md",
    "directory": "test-usability-direct",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_create",
      "mysql_fulltext_drop",
      "mysql_fulltext_search"
    ]
  },
  {
    "filename": "test-usability-direct-fulltext-part2.md",
    "directory": "test-usability-direct",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_boolean",
      "mysql_fulltext_expand"
    ]
  },
  {
    "filename": "test-usability-direct-introspection-part1.md",
    "directory": "test-usability-direct",
    "group": "introspection",
    "tools": [
      "mysql_dependency_graph",
      "mysql_topological_sort",
      "mysql_cascade_simulator"
    ]
  },
  {
    "filename": "test-usability-direct-introspection-part2.md",
    "directory": "test-usability-direct",
    "group": "introspection",
    "tools": [
      "mysql_schema_snapshot",
      "mysql_constraint_analysis",
      "mysql_migration_risks"
    ]
  },
  {
    "filename": "test-usability-direct-json-part1.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_extract",
      "mysql_json_set",
      "mysql_json_insert"
    ]
  },
  {
    "filename": "test-usability-direct-json-part2.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_replace",
      "mysql_json_remove",
      "mysql_json_contains"
    ]
  },
  {
    "filename": "test-usability-direct-json-part3.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_keys",
      "mysql_json_array_append",
      "mysql_json_get"
    ]
  },
  {
    "filename": "test-usability-direct-json-part4.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_update",
      "mysql_json_search",
      "mysql_json_validate"
    ]
  },
  {
    "filename": "test-usability-direct-json-part5.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff",
      "mysql_json_normalize"
    ]
  },
  {
    "filename": "test-usability-direct-json-part6.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_stats",
      "mysql_json_index_suggest"
    ]
  },
  {
    "filename": "test-usability-direct-migration-part1.md",
    "directory": "test-usability-direct",
    "group": "migration",
    "tools": [
      "mysql_migration_init",
      "mysql_migration_record",
      "mysql_migration_apply"
    ]
  },
  {
    "filename": "test-usability-direct-migration-part2.md",
    "directory": "test-usability-direct",
    "group": "migration",
    "tools": [
      "mysql_migration_rollback",
      "mysql_migration_history",
      "mysql_migration_status"
    ]
  },
  {
    "filename": "test-usability-direct-monitoring-part1.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_show_processlist",
      "mysql_show_status",
      "mysql_show_variables"
    ]
  },
  {
    "filename": "test-usability-direct-monitoring-part2.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_innodb_status",
      "mysql_replication_status",
      "mysql_pool_stats"
    ]
  },
  {
    "filename": "test-usability-direct-monitoring-part3.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_server_health"
    ]
  },
  {
    "filename": "test-usability-direct-optimization-part1.md",
    "directory": "test-usability-direct",
    "group": "optimization",
    "tools": [
      "mysql_index_recommendation",
      "mysql_query_rewrite",
      "mysql_force_index"
    ]
  },
  {
    "filename": "test-usability-direct-optimization-part2.md",
    "directory": "test-usability-direct",
    "group": "optimization",
    "tools": [
      "mysql_optimizer_trace"
    ]
  },
  {
    "filename": "test-usability-direct-partitioning-part1.md",
    "directory": "test-usability-direct",
    "group": "partitioning",
    "tools": [
      "mysql_partition_info",
      "mysql_add_partition",
      "mysql_drop_partition"
    ]
  },
  {
    "filename": "test-usability-direct-partitioning-part2.md",
    "directory": "test-usability-direct",
    "group": "partitioning",
    "tools": [
      "mysql_reorganize_partition"
    ]
  },
  {
    "filename": "test-usability-direct-performance-part1.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_explain",
      "mysql_explain_analyze",
      "mysql_slow_queries"
    ]
  },
  {
    "filename": "test-usability-direct-performance-part2.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_query_stats",
      "mysql_index_usage",
      "mysql_table_stats"
    ]
  },
  {
    "filename": "test-usability-direct-performance-part3.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats",
      "mysql_detect_query_anomalies"
    ]
  },
  {
    "filename": "test-usability-direct-performance-part4.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_detect_bloat_risk",
      "mysql_detect_connection_spike"
    ]
  },
  {
    "filename": "test-usability-direct-proxysql-part1.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_status",
      "proxysql_servers",
      "proxysql_query_rules"
    ]
  },
  {
    "filename": "test-usability-direct-proxysql-part2.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_query_digest",
      "proxysql_connection_pool",
      "proxysql_users"
    ]
  },
  {
    "filename": "test-usability-direct-proxysql-part3.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_runtime_status",
      "proxysql_memory_stats"
    ]
  },
  {
    "filename": "test-usability-direct-proxysql-part4.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_commands",
      "proxysql_process_list"
    ]
  },
  {
    "filename": "test-usability-direct-replication-part1.md",
    "directory": "test-usability-direct",
    "group": "replication",
    "tools": [
      "mysql_master_status",
      "mysql_slave_status",
      "mysql_binlog_events"
    ]
  },
  {
    "filename": "test-usability-direct-replication-part2.md",
    "directory": "test-usability-direct",
    "group": "replication",
    "tools": [
      "mysql_gtid_status",
      "mysql_replication_lag"
    ]
  },
  {
    "filename": "test-usability-direct-roles-part1.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_list",
      "mysql_role_create",
      "mysql_role_drop"
    ]
  },
  {
    "filename": "test-usability-direct-roles-part2.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_grants",
      "mysql_role_grant",
      "mysql_role_assign"
    ]
  },
  {
    "filename": "test-usability-direct-roles-part3.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_revoke",
      "mysql_user_roles"
    ]
  },
  {
    "filename": "test-usability-direct-router-part1.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_status",
      "mysql_router_routes",
      "mysql_router_route_status"
    ]
  },
  {
    "filename": "test-usability-direct-router-part2.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_route_health",
      "mysql_router_route_connections",
      "mysql_router_route_destinations"
    ]
  },
  {
    "filename": "test-usability-direct-router-part3.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_route_blocked_hosts",
      "mysql_router_metadata_status",
      "mysql_router_pool_status"
    ]
  },
  {
    "filename": "test-usability-direct-schema-part1.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_list_schemas",
      "mysql_create_schema",
      "mysql_drop_schema"
    ]
  },
  {
    "filename": "test-usability-direct-schema-part2.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_list_views",
      "mysql_create_view",
      "mysql_drop_view"
    ]
  },
  {
    "filename": "test-usability-direct-schema-part3.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions",
      "mysql_list_triggers"
    ]
  },
  {
    "filename": "test-usability-direct-schema-part4.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_create_trigger",
      "mysql_drop_trigger",
      "mysql_list_constraints"
    ]
  },
  {
    "filename": "test-usability-direct-security-part1.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_audit",
      "mysql_security_firewall_status",
      "mysql_security_firewall_rules"
    ]
  },
  {
    "filename": "test-usability-direct-security-part2.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_mask_data",
      "mysql_security_password_validate",
      "mysql_security_ssl_status"
    ]
  },
  {
    "filename": "test-usability-direct-security-part3.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables",
      "mysql_security_encryption_status"
    ]
  },
  {
    "filename": "test-usability-direct-shell-part1.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_version",
      "mysqlsh_check_upgrade",
      "mysqlsh_export_table"
    ]
  },
  {
    "filename": "test-usability-direct-shell-part2.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_import_table",
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ]
  },
  {
    "filename": "test-usability-direct-shell-part3.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables",
      "mysqlsh_load_dump"
    ]
  },
  {
    "filename": "test-usability-direct-shell-part4.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_run_script"
    ]
  },
  {
    "filename": "test-usability-direct-spatial-part1.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_create_column",
      "mysql_spatial_create_index",
      "mysql_spatial_point"
    ]
  },
  {
    "filename": "test-usability-direct-spatial-part2.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_polygon",
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ]
  },
  {
    "filename": "test-usability-direct-spatial-part3.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within",
      "mysql_spatial_intersection"
    ]
  },
  {
    "filename": "test-usability-direct-spatial-part4.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_buffer",
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part1.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles",
      "mysql_stats_correlation"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part2.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_distribution",
      "mysql_stats_time_series",
      "mysql_stats_regression"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part3.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram",
      "mysql_stats_row_number"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part4.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_rank",
      "mysql_stats_lag_lead",
      "mysql_stats_running_total"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part5.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_moving_avg",
      "mysql_stats_ntile",
      "mysql_stats_hypothesis"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part6.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_outliers",
      "mysql_stats_top_n",
      "mysql_stats_distinct"
    ]
  },
  {
    "filename": "test-usability-direct-stats-part7.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_frequency",
      "mysql_stats_summary"
    ]
  },
  {
    "filename": "test-usability-direct-sysschema-part1.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_user_summary",
      "mysql_sys_io_summary",
      "mysql_sys_statement_summary"
    ]
  },
  {
    "filename": "test-usability-direct-sysschema-part2.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_wait_summary",
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ]
  },
  {
    "filename": "test-usability-direct-sysschema-part3.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ]
  },
  {
    "filename": "test-usability-direct-text-part1.md",
    "directory": "test-usability-direct",
    "group": "text",
    "tools": [
      "mysql_regexp_match",
      "mysql_like_search",
      "mysql_soundex"
    ]
  },
  {
    "filename": "test-usability-direct-text-part2.md",
    "directory": "test-usability-direct",
    "group": "text",
    "tools": [
      "mysql_substring",
      "mysql_concat",
      "mysql_collation_convert"
    ]
  },
  {
    "filename": "test-usability-direct-transactions-part1.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit",
      "mysql_transaction_rollback"
    ]
  },
  {
    "filename": "test-usability-direct-transactions-part2.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_savepoint",
      "mysql_transaction_release",
      "mysql_transaction_rollback_to"
    ]
  },
  {
    "filename": "test-usability-direct-transactions-part3.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_execute"
    ]
  },
  {
    "filename": "test-usability-direct-vector-part1.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_store",
      "mysql_vector_batch_store",
      "mysql_vector_delete"
    ]
  },
  {
    "filename": "test-usability-direct-vector-part2.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_get",
      "mysql_vector_search",
      "mysql_vector_range_search"
    ]
  },
  {
    "filename": "test-usability-direct-vector-part3.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_hybrid_search",
      "mysql_vector_info",
      "mysql_vector_create_index"
    ]
  },
  {
    "filename": "test-usability-direct-vector-part4.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_optimize",
      "mysql_vector_stats"
    ]
  },
  {
    "filename": "test-admin-audit.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config",
      "mysql_audit_search"
    ]
  },
  {
    "filename": "test-admin-maintenance-part1a.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table",
      "mysql_check_table"
    ]
  },
  {
    "filename": "test-admin-maintenance-part1b.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_repair_table",
      "mysql_flush_tables",
      "mysql_kill_query"
    ]
  },
  {
    "filename": "test-backup-audit.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup",
      "mysql_audit_diff_backup"
    ]
  },
  {
    "filename": "test-backup-data-part1.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data"
    ]
  },
  {
    "filename": "test-backup-data-part2.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_create_dump",
      "mysql_restore_dump"
    ]
  },
  {
    "filename": "test-cluster-group-replication-part1.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_gr_status",
      "mysql_gr_members",
      "mysql_gr_primary"
    ]
  },
  {
    "filename": "test-cluster-group-replication-part2.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_gr_transactions",
      "mysql_gr_flow_control"
    ]
  },
  {
    "filename": "test-cluster-innodb-part1.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_cluster_status",
      "mysql_cluster_instances",
      "mysql_cluster_topology"
    ]
  },
  {
    "filename": "test-cluster-innodb-part2.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_cluster_router_status",
      "mysql_cluster_switchover"
    ]
  },
  {
    "filename": "test-core-read-part1.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_read_query",
      "mysql_list_tables"
    ]
  },
  {
    "filename": "test-core-read-part2.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_describe_table",
      "mysql_get_indexes"
    ]
  },
  {
    "filename": "test-core-write-part1.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_write_query",
      "mysql_create_table"
    ]
  },
  {
    "filename": "test-core-write-part2.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_drop_table",
      "mysql_create_index"
    ]
  },
  {
    "filename": "test-docstore-collections-part1.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_list_collections",
      "mysql_doc_create_collection",
      "mysql_doc_drop_collection"
    ]
  },
  {
    "filename": "test-docstore-collections-part2.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_create_index",
      "mysql_doc_collection_info"
    ]
  },
  {
    "filename": "test-docstore-documents-part1.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_find",
      "mysql_doc_add"
    ]
  },
  {
    "filename": "test-docstore-documents-part2.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_modify",
      "mysql_doc_remove"
    ]
  },
  {
    "filename": "test-events-part1a.md",
    "directory": "test-tool-groups",
    "group": "events",
    "tools": [
      "mysql_event_create",
      "mysql_event_alter",
      "mysql_event_drop"
    ]
  },
  {
    "filename": "test-events-part1b.md",
    "directory": "test-tool-groups",
    "group": "events",
    "tools": [
      "mysql_event_list",
      "mysql_event_status",
      "mysql_scheduler_status"
    ]
  },
  {
    "filename": "test-fulltext-part1a.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_create"
    ]
  },
  {
    "filename": "test-fulltext-part1b.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_drop"
    ]
  },
  {
    "filename": "test-fulltext-part2a.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_search",
      "mysql_fulltext_boolean",
      "mysql_fulltext_expand"
    ]
  },
  {
    "filename": "test-introspection-part1a.md",
    "directory": "test-tool-groups",
    "group": "introspection",
    "tools": [
      "mysql_dependency_graph",
      "mysql_topological_sort",
      "mysql_cascade_simulator"
    ]
  },
  {
    "filename": "test-introspection-part1b.md",
    "directory": "test-tool-groups",
    "group": "introspection",
    "tools": [
      "mysql_schema_snapshot",
      "mysql_constraint_analysis",
      "mysql_migration_risks"
    ]
  },
  {
    "filename": "test-json-core-read.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_extract",
      "mysql_json_contains",
      "mysql_json_keys"
    ]
  },
  {
    "filename": "test-json-core-write-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_set",
      "mysql_json_insert",
      "mysql_json_replace"
    ]
  },
  {
    "filename": "test-json-core-write-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_remove",
      "mysql_json_array_append"
    ]
  },
  {
    "filename": "test-json-enhanced-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff"
    ]
  },
  {
    "filename": "test-json-enhanced-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_normalize",
      "mysql_json_stats",
      "mysql_json_index_suggest"
    ]
  },
  {
    "filename": "test-json-helpers-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_get",
      "mysql_json_update"
    ]
  },
  {
    "filename": "test-json-helpers-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_search",
      "mysql_json_validate"
    ]
  },
  {
    "filename": "test-migration-part1a.md",
    "directory": "test-tool-groups",
    "group": "migration",
    "tools": [
      "mysql_migration_init",
      "mysql_migration_record",
      "mysql_migration_apply"
    ]
  },
  {
    "filename": "test-migration-part1b.md",
    "directory": "test-tool-groups",
    "group": "migration",
    "tools": [
      "mysql_migration_rollback",
      "mysql_migration_history",
      "mysql_migration_status"
    ]
  },
  {
    "filename": "test-monitoring-part1a.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_show_processlist",
      "mysql_show_status"
    ]
  },
  {
    "filename": "test-monitoring-part1b.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_show_variables",
      "mysql_innodb_status"
    ]
  },
  {
    "filename": "test-monitoring-part2a.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_replication_status",
      "mysql_pool_stats",
      "mysql_server_health"
    ]
  },
  {
    "filename": "test-optimization-part1.md",
    "directory": "test-tool-groups",
    "group": "optimization",
    "tools": [
      "mysql_index_recommendation",
      "mysql_query_rewrite"
    ]
  },
  {
    "filename": "test-optimization-part2.md",
    "directory": "test-tool-groups",
    "group": "optimization",
    "tools": [
      "mysql_force_index",
      "mysql_optimizer_trace"
    ]
  },
  {
    "filename": "test-partitioning-part1.md",
    "directory": "test-tool-groups",
    "group": "partitioning",
    "tools": [
      "mysql_partition_info",
      "mysql_add_partition"
    ]
  },
  {
    "filename": "test-partitioning-part2.md",
    "directory": "test-tool-groups",
    "group": "partitioning",
    "tools": [
      "mysql_drop_partition",
      "mysql_reorganize_partition"
    ]
  },
  {
    "filename": "test-performance-analysis-queries-part1.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_explain",
      "mysql_explain_analyze"
    ]
  },
  {
    "filename": "test-performance-analysis-queries-part2.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_slow_queries",
      "mysql_query_stats"
    ]
  },
  {
    "filename": "test-performance-analysis-system-part1.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_index_usage",
      "mysql_table_stats"
    ]
  },
  {
    "filename": "test-performance-analysis-system-part2a.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats"
    ]
  },
  {
    "filename": "test-performance-anomaly.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_detect_query_anomalies",
      "mysql_detect_bloat_risk",
      "mysql_detect_connection_spike"
    ]
  },
  {
    "filename": "test-proxysql-config-part1.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_query_rules",
      "proxysql_users"
    ]
  },
  {
    "filename": "test-proxysql-config-part2.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_commands"
    ]
  },
  {
    "filename": "test-proxysql-status-part1a.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_status",
      "proxysql_servers"
    ]
  },
  {
    "filename": "test-proxysql-status-part1b.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_connection_pool",
      "proxysql_runtime_status"
    ]
  },
  {
    "filename": "test-proxysql-status-part2a.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_memory_stats",
      "proxysql_process_list",
      "proxysql_query_digest"
    ]
  },
  {
    "filename": "test-replication-part1.md",
    "directory": "test-tool-groups",
    "group": "replication",
    "tools": [
      "mysql_master_status",
      "mysql_slave_status",
      "mysql_binlog_events"
    ]
  },
  {
    "filename": "test-replication-part2.md",
    "directory": "test-tool-groups",
    "group": "replication",
    "tools": [
      "mysql_gtid_status",
      "mysql_replication_lag"
    ]
  },
  {
    "filename": "test-roles-grants-part1.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_grants",
      "mysql_role_grant"
    ]
  },
  {
    "filename": "test-roles-grants-part2.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_assign",
      "mysql_role_revoke"
    ]
  },
  {
    "filename": "test-roles-management-part1.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_list",
      "mysql_role_create"
    ]
  },
  {
    "filename": "test-roles-management-part2.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_drop",
      "mysql_user_roles"
    ]
  },
  {
    "filename": "test-router-core-part1.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_status",
      "mysql_router_routes"
    ]
  },
  {
    "filename": "test-router-core-part2.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_metadata_status",
      "mysql_router_pool_status"
    ]
  },
  {
    "filename": "test-router-routes-part1.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_route_status",
      "mysql_router_route_health",
      "mysql_router_route_connections"
    ]
  },
  {
    "filename": "test-router-routes-part2.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_route_destinations",
      "mysql_router_route_blocked_hosts"
    ]
  },
  {
    "filename": "test-schema-management-part1a.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_list_schemas",
      "mysql_create_schema"
    ]
  },
  {
    "filename": "test-schema-management-part1b.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_drop_schema",
      "mysql_list_views"
    ]
  },
  {
    "filename": "test-schema-management-part2a.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_create_view",
      "mysql_drop_view",
      "mysql_list_constraints"
    ]
  },
  {
    "filename": "test-schema-routines-part1.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions",
      "mysql_list_triggers"
    ]
  },
  {
    "filename": "test-schema-routines-part2.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_create_trigger",
      "mysql_drop_trigger"
    ]
  },
  {
    "filename": "test-security-audit-part1.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_audit",
      "mysql_security_mask_data"
    ]
  },
  {
    "filename": "test-security-audit-part2.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables"
    ]
  },
  {
    "filename": "test-security-firewall-part1.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_firewall_status",
      "mysql_security_firewall_rules"
    ]
  },
  {
    "filename": "test-security-firewall-part2.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_ssl_status",
      "mysql_security_encryption_status",
      "mysql_security_password_validate"
    ]
  },
  {
    "filename": "test-shell-data-part1a.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_version",
      "mysqlsh_check_upgrade"
    ]
  },
  {
    "filename": "test-shell-data-part1b.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_export_table",
      "mysqlsh_import_table"
    ]
  },
  {
    "filename": "test-shell-data-part2a.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ]
  },
  {
    "filename": "test-shell-data-part2b.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables"
    ]
  },
  {
    "filename": "test-shell-utils.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_load_dump",
      "mysqlsh_run_script"
    ]
  },
  {
    "filename": "test-spatial-geometry.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_point",
      "mysql_spatial_polygon"
    ]
  },
  {
    "filename": "test-spatial-operations-part1.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_intersection",
      "mysql_spatial_buffer"
    ]
  },
  {
    "filename": "test-spatial-operations-part2.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ]
  },
  {
    "filename": "test-spatial-queries-part1.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ]
  },
  {
    "filename": "test-spatial-queries-part2.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within"
    ]
  },
  {
    "filename": "test-spatial-setup.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_create_column",
      "mysql_spatial_create_index"
    ]
  },
  {
    "filename": "test-stats-advanced-part1a.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_hypothesis",
      "mysql_stats_outliers",
      "mysql_stats_top_n"
    ]
  },
  {
    "filename": "test-stats-advanced-part1b.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_distinct",
      "mysql_stats_frequency",
      "mysql_stats_summary"
    ]
  },
  {
    "filename": "test-stats-analytics.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_correlation",
      "mysql_stats_time_series",
      "mysql_stats_regression"
    ]
  },
  {
    "filename": "test-stats-basic-part1.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles",
      "mysql_stats_distribution"
    ]
  },
  {
    "filename": "test-stats-basic-part2.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram"
    ]
  },
  {
    "filename": "test-stats-window-part1a.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_row_number",
      "mysql_stats_rank",
      "mysql_stats_lag_lead"
    ]
  },
  {
    "filename": "test-stats-window-part1b.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_running_total",
      "mysql_stats_moving_avg",
      "mysql_stats_ntile"
    ]
  },
  {
    "filename": "test-sys-analysis-part1.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_statement_summary",
      "mysql_sys_wait_summary"
    ]
  },
  {
    "filename": "test-sys-analysis-part2.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ]
  },
  {
    "filename": "test-sys-metrics-part1.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_user_summary",
      "mysql_sys_io_summary"
    ]
  },
  {
    "filename": "test-sys-metrics-part2.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ]
  },
  {
    "filename": "test-text-part1a.md",
    "directory": "test-tool-groups",
    "group": "text",
    "tools": [
      "mysql_regexp_match",
      "mysql_like_search",
      "mysql_soundex"
    ]
  },
  {
    "filename": "test-text-part1b.md",
    "directory": "test-tool-groups",
    "group": "text",
    "tools": [
      "mysql_substring",
      "mysql_concat",
      "mysql_collation_convert"
    ]
  },
  {
    "filename": "test-transactions-part1a.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit"
    ]
  },
  {
    "filename": "test-transactions-part1b.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_rollback",
      "mysql_transaction_savepoint"
    ]
  },
  {
    "filename": "test-transactions-part2a.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_release",
      "mysql_transaction_rollback_to",
      "mysql_transaction_execute"
    ]
  },
  {
    "filename": "test-vector-management-part1.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_info",
      "mysql_vector_create_index"
    ]
  },
  {
    "filename": "test-vector-management-part2.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_optimize",
      "mysql_vector_stats"
    ]
  },
  {
    "filename": "test-vector-search.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_search",
      "mysql_vector_range_search",
      "mysql_vector_hybrid_search"
    ]
  },
  {
    "filename": "test-vector-storage-part1.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_store",
      "mysql_vector_batch_store"
    ]
  },
  {
    "filename": "test-vector-storage-part2.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_delete",
      "mysql_vector_get"
    ]
  },
  {
    "filename": "test-versioning-part1.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_enable_versioning",
      "mysql_disable_versioning"
    ]
  },
  {
    "filename": "test-versioning-part2.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_check_version",
      "mysql_conditional_update"
    ]
  }
];

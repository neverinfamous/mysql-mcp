import { TestFileEntry } from './lib/types';

export const TEST_FILES: TestFileEntry[] = [
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
    "filename": "test-usability-transactions-part1.md",
    "directory": "test-usability",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-transactions-part2.md",
    "directory": "test-usability",
    "group": "transactions",
    "tools": [
      "mysql_transaction_rollback",
      "mysql_transaction_savepoint"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-transactions-part3.md",
    "directory": "test-usability",
    "group": "transactions",
    "tools": [
      "mysql_transaction_release",
      "mysql_transaction_rollback_to"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-transactions-part4.md",
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
      "mysql_vector_batch_store"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part2.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_delete",
      "mysql_vector_get"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part3.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_search",
      "mysql_vector_range_search"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part4.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_hybrid_search",
      "mysql_vector_info"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part5.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_create_index",
      "mysql_vector_optimize"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-vector-part6.md",
    "directory": "test-usability",
    "group": "vector",
    "tools": [
      "mysql_vector_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-admin-audit-part1.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-admin-audit-part2.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_audit_search"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-admin-maintenance-part1a.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-admin-maintenance-part1c.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_check_table"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-admin-maintenance-part1b.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_repair_table",
      "mysql_flush_tables"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-admin-maintenance-part1d.md",
    "directory": "test-tool-groups",
    "group": "admin",
    "tools": [
      "mysql_kill_query"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-backup-audit-part1.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-backup-audit-part2.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_audit_diff_backup"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-backup-data-part1.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-backup-data-part2.md",
    "directory": "test-tool-groups",
    "group": "backup",
    "tools": [
      "mysql_create_dump",
      "mysql_restore_dump"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-cluster-group-replication-part1.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_gr_status",
      "mysql_gr_members"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-cluster-group-replication-part3.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_gr_primary"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-cluster-group-replication-part2.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_gr_transactions",
      "mysql_gr_flow_control"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-cluster-innodb-part1.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_cluster_status",
      "mysql_cluster_instances"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-cluster-innodb-part3.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_cluster_topology"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-cluster-innodb-part2.md",
    "directory": "test-tool-groups",
    "group": "cluster",
    "tools": [
      "mysql_cluster_router_status",
      "mysql_cluster_switchover"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-core-read-part1.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_read_query",
      "mysql_list_tables"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-core-read-part2.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_describe_table",
      "mysql_get_indexes"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-core-write-part1.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_write_query",
      "mysql_create_table"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-core-write-part2.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_drop_table",
      "mysql_create_index"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-docstore-collections-part1.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_list_collections",
      "mysql_doc_create_collection"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-docstore-collections-part3.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_drop_collection"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-docstore-collections-part2.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_create_index",
      "mysql_doc_collection_info"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-docstore-documents-part1.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_find",
      "mysql_doc_add"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-docstore-documents-part2.md",
    "directory": "test-tool-groups",
    "group": "docstore",
    "tools": [
      "mysql_doc_modify",
      "mysql_doc_remove"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-events-part1a.md",
    "directory": "test-tool-groups",
    "group": "events",
    "tools": [
      "mysql_event_create",
      "mysql_event_alter"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-events-part1b.md",
    "directory": "test-tool-groups",
    "group": "events",
    "tools": [
      "mysql_event_list",
      "mysql_event_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-events-part1c.md",
    "directory": "test-tool-groups",
    "group": "events",
    "tools": [
      "mysql_event_drop"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-events-part1d.md",
    "directory": "test-tool-groups",
    "group": "events",
    "tools": [
      "mysql_scheduler_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-fulltext-part1a.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_create"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-fulltext-part1b.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_drop"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-fulltext-part2a.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_search",
      "mysql_fulltext_boolean"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-fulltext-part2b.md",
    "directory": "test-tool-groups",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_expand"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-introspection-part1a.md",
    "directory": "test-tool-groups",
    "group": "introspection",
    "tools": [
      "mysql_dependency_graph",
      "mysql_topological_sort"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-introspection-part1c.md",
    "directory": "test-tool-groups",
    "group": "introspection",
    "tools": [
      "mysql_cascade_simulator"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-introspection-part1b.md",
    "directory": "test-tool-groups",
    "group": "introspection",
    "tools": [
      "mysql_schema_snapshot",
      "mysql_constraint_analysis"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-introspection-part1d.md",
    "directory": "test-tool-groups",
    "group": "introspection",
    "tools": [
      "mysql_migration_risks"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-core-read-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_extract",
      "mysql_json_contains"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-core-read-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_keys"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-core-write-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_set",
      "mysql_json_insert"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-core-write-part3.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_replace"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-core-write-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_remove",
      "mysql_json_array_append"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-enhanced-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-enhanced-part2-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_normalize",
      "mysql_json_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-enhanced-part2-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_index_suggest"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-helpers-part1.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_get",
      "mysql_json_update"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-json-helpers-part2.md",
    "directory": "test-tool-groups",
    "group": "json",
    "tools": [
      "mysql_json_search",
      "mysql_json_validate"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-migration-part1.md",
    "directory": "test-tool-groups",
    "group": "migration",
    "tools": [
      "mysql_migration_init",
      "mysql_migration_record"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-migration-part2.md",
    "directory": "test-tool-groups",
    "group": "migration",
    "tools": [
      "mysql_migration_apply",
      "mysql_migration_rollback"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-migration-part3.md",
    "directory": "test-tool-groups",
    "group": "migration",
    "tools": [
      "mysql_migration_history",
      "mysql_migration_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-monitoring-part1.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_show_processlist",
      "mysql_show_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-monitoring-part2.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_show_variables",
      "mysql_innodb_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-monitoring-part3.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_replication_status",
      "mysql_pool_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-monitoring-part4.md",
    "directory": "test-tool-groups",
    "group": "monitoring",
    "tools": [
      "mysql_server_health"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-optimization-part1.md",
    "directory": "test-tool-groups",
    "group": "optimization",
    "tools": [
      "mysql_index_recommendation",
      "mysql_query_rewrite"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-optimization-part2.md",
    "directory": "test-tool-groups",
    "group": "optimization",
    "tools": [
      "mysql_force_index",
      "mysql_optimizer_trace"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-partitioning-part1.md",
    "directory": "test-tool-groups",
    "group": "partitioning",
    "tools": [
      "mysql_partition_info",
      "mysql_add_partition"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-partitioning-part2.md",
    "directory": "test-tool-groups",
    "group": "partitioning",
    "tools": [
      "mysql_drop_partition",
      "mysql_reorganize_partition"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-performance-analysis-queries-part1.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_explain",
      "mysql_explain_analyze"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-performance-analysis-queries-part2.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_slow_queries",
      "mysql_query_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-performance-analysis-system-part1.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_index_usage",
      "mysql_table_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-performance-analysis-system-part2a.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-performance-anomaly-part1.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_detect_query_anomalies",
      "mysql_detect_bloat_risk"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-performance-anomaly-part2.md",
    "directory": "test-tool-groups",
    "group": "performance",
    "tools": [
      "mysql_detect_connection_spike"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-proxysql-config-part1.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_query_rules",
      "proxysql_users"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-proxysql-config-part2.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_commands"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-proxysql-status-part1a.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_status",
      "proxysql_servers"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-proxysql-status-part1b.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_connection_pool",
      "proxysql_runtime_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-proxysql-status-part2a.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_memory_stats",
      "proxysql_process_list"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-proxysql-status-part2b.md",
    "directory": "test-tool-groups",
    "group": "proxysql",
    "tools": [
      "proxysql_query_digest"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-replication-part1.md",
    "directory": "test-tool-groups",
    "group": "replication",
    "tools": [
      "mysql_master_status",
      "mysql_slave_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-replication-part2.md",
    "directory": "test-tool-groups",
    "group": "replication",
    "tools": [
      "mysql_binlog_events"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-replication-part3.md",
    "directory": "test-tool-groups",
    "group": "replication",
    "tools": [
      "mysql_gtid_status",
      "mysql_replication_lag"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-roles-grants-part1.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_grants",
      "mysql_role_grant"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-roles-grants-part2.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_assign",
      "mysql_role_revoke"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-roles-management-part1.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_list",
      "mysql_role_create"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-roles-management-part2.md",
    "directory": "test-tool-groups",
    "group": "roles",
    "tools": [
      "mysql_role_drop",
      "mysql_user_roles"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-router-core-part1.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_status",
      "mysql_router_routes"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-router-core-part2.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_metadata_status",
      "mysql_router_pool_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-router-routes-part1.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_route_status",
      "mysql_router_route_health"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-router-routes-part2.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_route_destinations",
      "mysql_router_route_blocked_hosts"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-router-routes-part3.md",
    "directory": "test-tool-groups",
    "group": "router",
    "tools": [
      "mysql_router_route_connections"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-management-part1a.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_list_schemas",
      "mysql_create_schema"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-management-part1b.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_drop_schema",
      "mysql_list_views"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-management-part2a.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_create_view",
      "mysql_drop_view"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-management-part2b.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_list_constraints"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-routines-part1.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-routines-part2.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_create_trigger",
      "mysql_drop_trigger"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-schema-routines-part3.md",
    "directory": "test-tool-groups",
    "group": "schema",
    "tools": [
      "mysql_list_triggers"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-security-audit-part1.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_audit",
      "mysql_security_mask_data"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-security-audit-part2.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-security-firewall-part1.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_firewall_status",
      "mysql_security_firewall_rules"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-security-firewall-part2-part1.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_ssl_status",
      "mysql_security_encryption_status"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-security-firewall-part2-part2.md",
    "directory": "test-tool-groups",
    "group": "security",
    "tools": [
      "mysql_security_password_validate"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-shell-data-part1a.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_version",
      "mysqlsh_check_upgrade"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-shell-data-part1b.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_export_table",
      "mysqlsh_import_table"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-shell-data-part2a.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-shell-data-part2b.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-shell-utils.md",
    "directory": "test-tool-groups",
    "group": "shell",
    "tools": [
      "mysqlsh_load_dump",
      "mysqlsh_run_script"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-spatial-geometry.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_point",
      "mysql_spatial_polygon"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-spatial-operations-part1.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_intersection",
      "mysql_spatial_buffer"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-spatial-operations-part2.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-spatial-queries-part1.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-spatial-queries-part2.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-spatial-setup.md",
    "directory": "test-tool-groups",
    "group": "spatial",
    "tools": [
      "mysql_spatial_create_column",
      "mysql_spatial_create_index"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-advanced-part1a.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_hypothesis",
      "mysql_stats_outliers"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-advanced-part1c.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_top_n"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-advanced-part1b.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_distinct",
      "mysql_stats_frequency"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-advanced-part1d.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_summary"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-analytics-part1.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_correlation",
      "mysql_stats_time_series"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-analytics-part2.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_regression"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-basic-part1.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-basic-part3.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_distribution"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-basic-part2.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-window-part1a.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_row_number",
      "mysql_stats_rank"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-window-part1c.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_lag_lead"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-window-part1b.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_running_total",
      "mysql_stats_moving_avg"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-stats-window-part1d.md",
    "directory": "test-tool-groups",
    "group": "stats",
    "tools": [
      "mysql_stats_ntile"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-sys-analysis-part1.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_statement_summary",
      "mysql_sys_wait_summary"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-sys-analysis-part2.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-sys-metrics-part1.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_user_summary",
      "mysql_sys_io_summary"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-sys-metrics-part2.md",
    "directory": "test-tool-groups",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-text-part1a.md",
    "directory": "test-tool-groups",
    "group": "text",
    "tools": [
      "mysql_regexp_match",
      "mysql_like_search"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-text-part1c.md",
    "directory": "test-tool-groups",
    "group": "text",
    "tools": [
      "mysql_soundex"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-text-part1b.md",
    "directory": "test-tool-groups",
    "group": "text",
    "tools": [
      "mysql_substring",
      "mysql_concat"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-text-part1d.md",
    "directory": "test-tool-groups",
    "group": "text",
    "tools": [
      "mysql_collation_convert"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-transactions-part1a.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-transactions-part1b.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_rollback",
      "mysql_transaction_savepoint"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-transactions-part2a.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_release",
      "mysql_transaction_rollback_to"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-transactions-part2b.md",
    "directory": "test-tool-groups",
    "group": "transactions",
    "tools": [
      "mysql_transaction_execute"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-vector-management-part1.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_info",
      "mysql_vector_create_index"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-vector-management-part2.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_optimize",
      "mysql_vector_stats"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-vector-search-part1.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_search",
      "mysql_vector_range_search"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-vector-search-part2.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_hybrid_search"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-vector-storage-part1.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_store",
      "mysql_vector_batch_store"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-vector-storage-part2.md",
    "directory": "test-tool-groups",
    "group": "vector",
    "tools": [
      "mysql_vector_delete",
      "mysql_vector_get"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-versioning-part1.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_enable_versioning",
      "mysql_disable_versioning"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-versioning-part2.md",
    "directory": "test-tool-groups",
    "group": "core",
    "tools": [
      "mysql_check_version",
      "mysql_conditional_update"
    ],
    "contentPartial": "test-tool-groups.content.md"
  },
  {
    "filename": "test-usability-admin-part1.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-admin-part2.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_check_table",
      "mysql_repair_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-admin-part3.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_flush_tables",
      "mysql_kill_query"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-admin-part4.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-admin-part5.md",
    "directory": "test-usability",
    "group": "admin",
    "tools": [
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
      "mysql_event_alter"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-events-part2.md",
    "directory": "test-usability",
    "group": "events",
    "tools": [
      "mysql_event_drop",
      "mysql_event_list"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-events-part3.md",
    "directory": "test-usability",
    "group": "events",
    "tools": [
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
      "mysql_topological_sort"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-introspection-part2.md",
    "directory": "test-usability",
    "group": "introspection",
    "tools": [
      "mysql_cascade_simulator",
      "mysql_schema_snapshot"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-introspection-part3.md",
    "directory": "test-usability",
    "group": "introspection",
    "tools": [
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
      "mysql_migration_record"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-migration-part2.md",
    "directory": "test-usability",
    "group": "migration",
    "tools": [
      "mysql_migration_apply",
      "mysql_migration_rollback"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-migration-part3.md",
    "directory": "test-usability",
    "group": "migration",
    "tools": [
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
      "mysql_like_search"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-text-part2.md",
    "directory": "test-usability",
    "group": "text",
    "tools": [
      "mysql_soundex",
      "mysql_substring"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-text-part3.md",
    "directory": "test-usability",
    "group": "text",
    "tools": [
      "mysql_concat",
      "mysql_collation_convert"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-backup-part1.md",
    "directory": "test-usability",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-backup-part2.md",
    "directory": "test-usability",
    "group": "backup",
    "tools": [
      "mysql_create_dump",
      "mysql_restore_dump"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-backup-part3.md",
    "directory": "test-usability",
    "group": "backup",
    "tools": [
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-backup-part4.md",
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
      "mysql_gr_members"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part2.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_gr_primary",
      "mysql_gr_transactions"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part3.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_gr_flow_control",
      "mysql_cluster_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part4.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_cluster_instances",
      "mysql_cluster_topology"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-cluster-part5.md",
    "directory": "test-usability",
    "group": "cluster",
    "tools": [
      "mysql_cluster_router_status",
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
      "mysql_write_query"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part2.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_list_tables",
      "mysql_describe_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part3.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_create_table",
      "mysql_drop_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part4.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_create_index",
      "mysql_get_indexes"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part5.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
      "mysql_enable_versioning",
      "mysql_disable_versioning"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-core-part6.md",
    "directory": "test-usability",
    "group": "core",
    "tools": [
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
      "mysql_doc_create_collection"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part2.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
      "mysql_doc_drop_collection",
      "mysql_doc_find"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part3.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
      "mysql_doc_add",
      "mysql_doc_modify"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part4.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
      "mysql_doc_remove",
      "mysql_doc_create_index"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-docstore-part5.md",
    "directory": "test-usability",
    "group": "docstore",
    "tools": [
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
      "mysql_fulltext_drop"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-fulltext-part2.md",
    "directory": "test-usability",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_search",
      "mysql_fulltext_boolean"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-fulltext-part3.md",
    "directory": "test-usability",
    "group": "fulltext",
    "tools": [
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
      "mysql_json_set"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part2.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_insert",
      "mysql_json_replace"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part3.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_remove",
      "mysql_json_contains"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part4.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_keys",
      "mysql_json_array_append"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part5.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_get",
      "mysql_json_update"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part6.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_search",
      "mysql_json_validate"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part7.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part8.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
      "mysql_json_normalize",
      "mysql_json_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-json-part9.md",
    "directory": "test-usability",
    "group": "json",
    "tools": [
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
      "mysql_show_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-monitoring-part2.md",
    "directory": "test-usability",
    "group": "monitoring",
    "tools": [
      "mysql_show_variables",
      "mysql_innodb_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-monitoring-part3.md",
    "directory": "test-usability",
    "group": "monitoring",
    "tools": [
      "mysql_replication_status",
      "mysql_pool_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-monitoring-part4.md",
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
      "mysql_query_rewrite"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-optimization-part2.md",
    "directory": "test-usability",
    "group": "optimization",
    "tools": [
      "mysql_force_index",
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
      "mysql_add_partition"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-partitioning-part2.md",
    "directory": "test-usability",
    "group": "partitioning",
    "tools": [
      "mysql_drop_partition",
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
      "mysql_explain_analyze"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part2.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_slow_queries",
      "mysql_query_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part3.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_index_usage",
      "mysql_table_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part4.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part5.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
      "mysql_detect_query_anomalies",
      "mysql_detect_bloat_risk"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-performance-part6.md",
    "directory": "test-usability",
    "group": "performance",
    "tools": [
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
      "proxysql_servers"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part2.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_query_rules",
      "proxysql_query_digest"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part3.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_connection_pool",
      "proxysql_users"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part4.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_runtime_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part5.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
      "proxysql_memory_stats",
      "proxysql_commands"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-proxysql-part6.md",
    "directory": "test-usability",
    "group": "proxysql",
    "tools": [
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
      "mysql_slave_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-replication-part2.md",
    "directory": "test-usability",
    "group": "replication",
    "tools": [
      "mysql_binlog_events",
      "mysql_gtid_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-replication-part3.md",
    "directory": "test-usability",
    "group": "replication",
    "tools": [
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
      "mysql_role_create"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-roles-part2.md",
    "directory": "test-usability",
    "group": "roles",
    "tools": [
      "mysql_role_drop",
      "mysql_role_grants"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-roles-part3.md",
    "directory": "test-usability",
    "group": "roles",
    "tools": [
      "mysql_role_grant",
      "mysql_role_assign"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-roles-part4.md",
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
      "mysql_router_routes"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part2.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
      "mysql_router_route_status",
      "mysql_router_route_health"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part3.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
      "mysql_router_route_connections",
      "mysql_router_route_destinations"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part4.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
      "mysql_router_route_blocked_hosts",
      "mysql_router_metadata_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-router-part5.md",
    "directory": "test-usability",
    "group": "router",
    "tools": [
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
      "mysql_create_schema"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part2.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_drop_schema",
      "mysql_list_views"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part3.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_create_view",
      "mysql_drop_view"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part4.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part5.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
      "mysql_list_triggers",
      "mysql_create_trigger"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-schema-part6.md",
    "directory": "test-usability",
    "group": "schema",
    "tools": [
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
      "mysql_security_firewall_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part2.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
      "mysql_security_firewall_rules",
      "mysql_security_mask_data"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part3.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
      "mysql_security_password_validate",
      "mysql_security_ssl_status"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part4.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-security-part5.md",
    "directory": "test-usability",
    "group": "security",
    "tools": [
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
      "mysqlsh_check_upgrade"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part2.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_export_table",
      "mysqlsh_import_table"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part3.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part4.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-shell-part5.md",
    "directory": "test-usability",
    "group": "shell",
    "tools": [
      "mysqlsh_load_dump",
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
      "mysql_spatial_create_index"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part2.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_point",
      "mysql_spatial_polygon"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part3.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part4.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part5.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_intersection",
      "mysql_spatial_buffer"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-spatial-part6.md",
    "directory": "test-usability",
    "group": "spatial",
    "tools": [
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-admin-part1.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_optimize_table",
      "mysql_analyze_table"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-admin-part2.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_check_table",
      "mysql_repair_table"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-admin-part3.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_flush_tables",
      "mysql_kill_query"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-admin-part4.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_append_insight",
      "mysql_server_config"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-admin-part5.md",
    "directory": "test-usability-direct",
    "group": "admin",
    "tools": [
      "mysql_audit_search"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-backup-part1.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_export_table",
      "mysql_import_data"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-backup-part2.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_create_dump",
      "mysql_restore_dump"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-backup-part3.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_audit_list_backups",
      "mysql_audit_restore_backup"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-backup-part4.md",
    "directory": "test-usability-direct",
    "group": "backup",
    "tools": [
      "mysql_audit_diff_backup"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-cluster-part1.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_gr_status",
      "mysql_gr_members"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-cluster-part2.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_gr_primary",
      "mysql_gr_transactions"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-cluster-part3.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_gr_flow_control",
      "mysql_cluster_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-cluster-part4.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_cluster_instances",
      "mysql_cluster_topology"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-cluster-part5.md",
    "directory": "test-usability-direct",
    "group": "cluster",
    "tools": [
      "mysql_cluster_router_status",
      "mysql_cluster_switchover"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-core-part1.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_read_query",
      "mysql_write_query"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-core-part2.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_list_tables",
      "mysql_describe_table"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-core-part3.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_create_table",
      "mysql_drop_table"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-core-part4.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_create_index",
      "mysql_get_indexes"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-core-part5.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_enable_versioning",
      "mysql_disable_versioning"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-core-part6.md",
    "directory": "test-usability-direct",
    "group": "core",
    "tools": [
      "mysql_check_version",
      "mysql_conditional_update"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-docstore-part1.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_list_collections",
      "mysql_doc_create_collection"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-docstore-part2.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_drop_collection",
      "mysql_doc_find"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-docstore-part3.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_add",
      "mysql_doc_modify"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-docstore-part4.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_remove",
      "mysql_doc_create_index"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-docstore-part5.md",
    "directory": "test-usability-direct",
    "group": "docstore",
    "tools": [
      "mysql_doc_collection_info"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-events-part1.md",
    "directory": "test-usability-direct",
    "group": "events",
    "tools": [
      "mysql_event_create",
      "mysql_event_alter"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-events-part2.md",
    "directory": "test-usability-direct",
    "group": "events",
    "tools": [
      "mysql_event_drop",
      "mysql_event_list"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-events-part3.md",
    "directory": "test-usability-direct",
    "group": "events",
    "tools": [
      "mysql_event_status",
      "mysql_scheduler_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-fulltext-part1.md",
    "directory": "test-usability-direct",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_create",
      "mysql_fulltext_drop"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-fulltext-part2.md",
    "directory": "test-usability-direct",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_search",
      "mysql_fulltext_boolean"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-fulltext-part3.md",
    "directory": "test-usability-direct",
    "group": "fulltext",
    "tools": [
      "mysql_fulltext_expand"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-introspection-part1.md",
    "directory": "test-usability-direct",
    "group": "introspection",
    "tools": [
      "mysql_dependency_graph",
      "mysql_topological_sort"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-introspection-part2.md",
    "directory": "test-usability-direct",
    "group": "introspection",
    "tools": [
      "mysql_cascade_simulator",
      "mysql_schema_snapshot"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-introspection-part3.md",
    "directory": "test-usability-direct",
    "group": "introspection",
    "tools": [
      "mysql_constraint_analysis",
      "mysql_migration_risks"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part1.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_extract",
      "mysql_json_set"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part2.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_insert",
      "mysql_json_replace"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part3.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_remove",
      "mysql_json_contains"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part4.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_keys",
      "mysql_json_array_append"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part5.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_get",
      "mysql_json_update"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part6.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_search",
      "mysql_json_validate"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part7.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_merge",
      "mysql_json_diff"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part8.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_normalize",
      "mysql_json_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-json-part9.md",
    "directory": "test-usability-direct",
    "group": "json",
    "tools": [
      "mysql_json_index_suggest"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-migration-part1.md",
    "directory": "test-usability-direct",
    "group": "migration",
    "tools": [
      "mysql_migration_init",
      "mysql_migration_record"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-migration-part2.md",
    "directory": "test-usability-direct",
    "group": "migration",
    "tools": [
      "mysql_migration_apply",
      "mysql_migration_rollback"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-migration-part3.md",
    "directory": "test-usability-direct",
    "group": "migration",
    "tools": [
      "mysql_migration_history",
      "mysql_migration_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-monitoring-part1.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_show_processlist",
      "mysql_show_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-monitoring-part2.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_show_variables",
      "mysql_innodb_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-monitoring-part3.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_replication_status",
      "mysql_pool_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-monitoring-part4.md",
    "directory": "test-usability-direct",
    "group": "monitoring",
    "tools": [
      "mysql_server_health"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-optimization-part1.md",
    "directory": "test-usability-direct",
    "group": "optimization",
    "tools": [
      "mysql_index_recommendation",
      "mysql_query_rewrite"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-optimization-part2.md",
    "directory": "test-usability-direct",
    "group": "optimization",
    "tools": [
      "mysql_force_index",
      "mysql_optimizer_trace"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-partitioning-part1.md",
    "directory": "test-usability-direct",
    "group": "partitioning",
    "tools": [
      "mysql_partition_info",
      "mysql_add_partition"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-partitioning-part2.md",
    "directory": "test-usability-direct",
    "group": "partitioning",
    "tools": [
      "mysql_drop_partition",
      "mysql_reorganize_partition"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-performance-part1.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_explain",
      "mysql_explain_analyze"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-performance-part2.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_slow_queries",
      "mysql_query_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-performance-part3.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_index_usage",
      "mysql_table_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-performance-part4.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_buffer_pool_stats",
      "mysql_thread_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-performance-part5.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_detect_query_anomalies",
      "mysql_detect_bloat_risk"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-performance-part6.md",
    "directory": "test-usability-direct",
    "group": "performance",
    "tools": [
      "mysql_detect_connection_spike"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-proxysql-part1.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_status",
      "proxysql_servers"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-proxysql-part2.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_query_rules",
      "proxysql_query_digest"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-proxysql-part3.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_connection_pool",
      "proxysql_users"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-proxysql-part4.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_global_variables",
      "proxysql_runtime_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-proxysql-part5.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_memory_stats",
      "proxysql_commands"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-proxysql-part6.md",
    "directory": "test-usability-direct",
    "group": "proxysql",
    "tools": [
      "proxysql_process_list"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-replication-part1.md",
    "directory": "test-usability-direct",
    "group": "replication",
    "tools": [
      "mysql_master_status",
      "mysql_slave_status"
    ],
    "contentPartial": "test-usability-direct-replication.content.md"
  },
  {
    "filename": "test-usability-direct-replication-part2.md",
    "directory": "test-usability-direct",
    "group": "replication",
    "tools": [
      "mysql_binlog_events",
      "mysql_gtid_status"
    ],
    "contentPartial": "test-usability-direct-replication.content.md"
  },
  {
    "filename": "test-usability-direct-replication-part3.md",
    "directory": "test-usability-direct",
    "group": "replication",
    "tools": [
      "mysql_replication_lag"
    ],
    "contentPartial": "test-usability-direct-replication.content.md"
  },
  {
    "filename": "test-usability-direct-roles-part1.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_list",
      "mysql_role_create"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-roles-part2.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_drop",
      "mysql_role_grants"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-roles-part3.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_grant",
      "mysql_role_assign"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-roles-part4.md",
    "directory": "test-usability-direct",
    "group": "roles",
    "tools": [
      "mysql_role_revoke",
      "mysql_user_roles"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-router-part1.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_status",
      "mysql_router_routes"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-router-part2.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_route_status",
      "mysql_router_route_health"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-router-part3.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_route_connections",
      "mysql_router_route_destinations"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-router-part4.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_route_blocked_hosts",
      "mysql_router_metadata_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-router-part5.md",
    "directory": "test-usability-direct",
    "group": "router",
    "tools": [
      "mysql_router_pool_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-schema-part1.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_list_schemas",
      "mysql_create_schema"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-schema-part2.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_drop_schema",
      "mysql_list_views"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-schema-part3.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_create_view",
      "mysql_drop_view"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-schema-part4.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_list_stored_procedures",
      "mysql_list_functions"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-schema-part5.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_list_triggers",
      "mysql_create_trigger"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-schema-part6.md",
    "directory": "test-usability-direct",
    "group": "schema",
    "tools": [
      "mysql_drop_trigger",
      "mysql_list_constraints"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-security-part1.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_audit",
      "mysql_security_firewall_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-security-part2.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_firewall_rules",
      "mysql_security_mask_data"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-security-part3.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_password_validate",
      "mysql_security_ssl_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-security-part4.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_user_privileges",
      "mysql_security_sensitive_tables"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-security-part5.md",
    "directory": "test-usability-direct",
    "group": "security",
    "tools": [
      "mysql_security_encryption_status"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-shell-part1.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_version",
      "mysqlsh_check_upgrade"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-shell-part2.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_export_table",
      "mysqlsh_import_table"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-shell-part3.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_import_json",
      "mysqlsh_dump_instance"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-shell-part4.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_dump_schemas",
      "mysqlsh_dump_tables"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-shell-part5.md",
    "directory": "test-usability-direct",
    "group": "shell",
    "tools": [
      "mysqlsh_load_dump",
      "mysqlsh_run_script"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-spatial-part1.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_create_column",
      "mysql_spatial_create_index"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-spatial-part2.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_point",
      "mysql_spatial_polygon"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-spatial-part3.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_distance",
      "mysql_spatial_distance_sphere"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-spatial-part4.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_contains",
      "mysql_spatial_within"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-spatial-part5.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_intersection",
      "mysql_spatial_buffer"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-spatial-part6.md",
    "directory": "test-usability-direct",
    "group": "spatial",
    "tools": [
      "mysql_spatial_transform",
      "mysql_spatial_geojson"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part1.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part2.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_correlation",
      "mysql_stats_distribution"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part3.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_time_series",
      "mysql_stats_regression"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part4.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part5.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_row_number",
      "mysql_stats_rank"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part6.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_lag_lead",
      "mysql_stats_running_total"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part7.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_moving_avg",
      "mysql_stats_ntile"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part8.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_hypothesis",
      "mysql_stats_outliers"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part9.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_top_n",
      "mysql_stats_distinct"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-stats-part10.md",
    "directory": "test-usability-direct",
    "group": "stats",
    "tools": [
      "mysql_stats_frequency",
      "mysql_stats_summary"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-sysschema-part1.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_user_summary",
      "mysql_sys_io_summary"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-sysschema-part2.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_statement_summary",
      "mysql_sys_wait_summary"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-sysschema-part3.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-sysschema-part4.md",
    "directory": "test-usability-direct",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-text-part1.md",
    "directory": "test-usability-direct",
    "group": "text",
    "tools": [
      "mysql_regexp_match",
      "mysql_like_search"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-text-part2.md",
    "directory": "test-usability-direct",
    "group": "text",
    "tools": [
      "mysql_soundex",
      "mysql_substring"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-text-part3.md",
    "directory": "test-usability-direct",
    "group": "text",
    "tools": [
      "mysql_concat",
      "mysql_collation_convert"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-transactions-part1.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_begin",
      "mysql_transaction_commit"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-transactions-part2.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_rollback",
      "mysql_transaction_savepoint"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-transactions-part3.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_release",
      "mysql_transaction_rollback_to"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-transactions-part4.md",
    "directory": "test-usability-direct",
    "group": "transactions",
    "tools": [
      "mysql_transaction_execute"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-vector-part1.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_store",
      "mysql_vector_batch_store"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-vector-part2.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_delete",
      "mysql_vector_get"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-vector-part3.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_search",
      "mysql_vector_range_search"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-vector-part4.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_hybrid_search",
      "mysql_vector_info"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-vector-part5.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_create_index",
      "mysql_vector_optimize"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-direct-vector-part6.md",
    "directory": "test-usability-direct",
    "group": "vector",
    "tools": [
      "mysql_vector_stats"
    ],
    "contentPartial": "test-usability-direct-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part1.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_descriptive",
      "mysql_stats_percentiles"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part2.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_correlation",
      "mysql_stats_distribution"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part3.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_time_series",
      "mysql_stats_regression"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part4.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_sampling",
      "mysql_stats_histogram"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part5.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_row_number",
      "mysql_stats_rank"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part6.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_lag_lead",
      "mysql_stats_running_total"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part7.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_moving_avg",
      "mysql_stats_ntile"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part8.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_hypothesis",
      "mysql_stats_outliers"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part9.md",
    "directory": "test-usability",
    "group": "stats",
    "tools": [
      "mysql_stats_top_n",
      "mysql_stats_distinct"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-stats-part10.md",
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
      "mysql_sys_io_summary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-sysschema-part2.md",
    "directory": "test-usability",
    "group": "sysschema",
    "tools": [
      "mysql_sys_statement_summary",
      "mysql_sys_wait_summary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-sysschema-part3.md",
    "directory": "test-usability",
    "group": "sysschema",
    "tools": [
      "mysql_sys_innodb_lock_waits",
      "mysql_sys_schema_stats"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  },
  {
    "filename": "test-usability-sysschema-part4.md",
    "directory": "test-usability",
    "group": "sysschema",
    "tools": [
      "mysql_sys_host_summary",
      "mysql_sys_memory_summary"
    ],
    "contentPartial": "test-usability-fuzzing.content.md"
  }
];

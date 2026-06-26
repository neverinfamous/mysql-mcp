
import os
import re

dir_path = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-tool-groups'
files = [f for f in os.listdir(dir_path) if f.endswith('.md') and f.startswith('test-')]

tested_tools = set()

for f in files:
    with open(os.path.join(dir_path, f), 'r', encoding='utf-8') as file:
        content = file.read()
        # Find all tools mentioned in the checklist section
        # We can just extract all mysql_ and proxysql_ words and assume they are tested if they appear
        # anywhere AFTER the word Checklist or after 'Group Focus'
        
        matches = re.findall(r'(mysql_[a-z0-9_]+|proxysql_[a-z0-9_]+)', content)
        tested_tools.update(matches)

ssot_text = '''
1. core
mysql_read_query, mysql_write_query, mysql_list_tables, mysql_describe_table, mysql_create_table, mysql_drop_table, mysql_create_index, mysql_get_indexes, mysql_enable_versioning, mysql_disable_versioning, mysql_check_version, mysql_conditional_update

2. json
mysql_json_extract, mysql_json_set, mysql_json_insert, mysql_json_replace, mysql_json_remove, mysql_json_contains, mysql_json_keys, mysql_json_array_append, mysql_json_get, mysql_json_update, mysql_json_search, mysql_json_validate, mysql_json_merge, mysql_json_diff, mysql_json_normalize, mysql_json_stats, mysql_json_index_suggest

3. text
mysql_regexp_match, mysql_like_search, mysql_soundex, mysql_substring, mysql_concat, mysql_collation_convert

4. fulltext
mysql_fulltext_create, mysql_fulltext_drop, mysql_fulltext_search, mysql_fulltext_boolean, mysql_fulltext_expand

5. performance
mysql_explain, mysql_explain_analyze, mysql_slow_queries, mysql_query_stats, mysql_index_usage, mysql_table_stats, mysql_buffer_pool_stats, mysql_thread_stats, mysql_detect_query_anomalies, mysql_detect_bloat_risk, mysql_detect_connection_spike

6. optimization
mysql_index_recommendation, mysql_query_rewrite, mysql_force_index, mysql_optimizer_trace

7. admin
mysql_optimize_table, mysql_analyze_table, mysql_check_table, mysql_repair_table, mysql_flush_tables, mysql_kill_query, mysql_append_insight, mysql_server_config, mysql_audit_search

8. monitoring
mysql_show_processlist, mysql_show_status, mysql_show_variables, mysql_innodb_status, mysql_replication_status, mysql_pool_stats, mysql_server_health

9. backup
mysql_export_table, mysql_import_data, mysql_create_dump, mysql_restore_dump, mysql_audit_list_backups, mysql_audit_restore_backup, mysql_audit_diff_backup

10. replication
mysql_master_status, mysql_slave_status, mysql_binlog_events, mysql_gtid_status, mysql_replication_lag

11. partitioning
mysql_partition_info, mysql_add_partition, mysql_drop_partition, mysql_reorganize_partition

12. transactions
mysql_transaction_begin, mysql_transaction_commit, mysql_transaction_rollback, mysql_transaction_savepoint, mysql_transaction_release, mysql_transaction_rollback_to, mysql_transaction_execute

13. router
mysql_router_status, mysql_router_routes, mysql_router_route_status, mysql_router_route_health, mysql_router_route_connections, mysql_router_route_destinations, mysql_router_route_blocked_hosts, mysql_router_metadata_status, mysql_router_pool_status

14. proxysql
proxysql_status, proxysql_servers, proxysql_query_rules, proxysql_query_digest, proxysql_connection_pool, proxysql_users, proxysql_global_variables, proxysql_runtime_status, proxysql_memory_stats, proxysql_commands, proxysql_process_list

15. shell
mysqlsh_version, mysqlsh_check_upgrade, mysqlsh_export_table, mysqlsh_import_table, mysqlsh_import_json, mysqlsh_dump_instance, mysqlsh_dump_schemas, mysqlsh_dump_tables, mysqlsh_load_dump, mysqlsh_run_script

16. schema
mysql_list_schemas, mysql_create_schema, mysql_drop_schema, mysql_list_views, mysql_create_view, mysql_drop_view, mysql_list_stored_procedures, mysql_list_functions, mysql_list_triggers, mysql_list_constraints, mysql_list_events

17. events
mysql_event_create, mysql_event_alter, mysql_event_drop, mysql_event_list, mysql_event_status, mysql_scheduler_status

18. sysschema
mysql_sys_user_summary, mysql_sys_io_summary, mysql_sys_statement_summary, mysql_sys_wait_summary, mysql_sys_innodb_lock_waits, mysql_sys_schema_stats, mysql_sys_host_summary, mysql_sys_memory_summary

19. stats
mysql_stats_descriptive, mysql_stats_percentiles, mysql_stats_correlation, mysql_stats_distribution, mysql_stats_time_series, mysql_stats_regression, mysql_stats_sampling, mysql_stats_histogram, mysql_stats_row_number, mysql_stats_rank, mysql_stats_lag_lead, mysql_stats_running_total, mysql_stats_moving_avg, mysql_stats_ntile, mysql_stats_hypothesis, mysql_stats_outliers, mysql_stats_top_n, mysql_stats_distinct, mysql_stats_frequency, mysql_stats_summary

20. spatial
mysql_spatial_create_column, mysql_spatial_create_index, mysql_spatial_point, mysql_spatial_polygon, mysql_spatial_distance, mysql_spatial_distance_sphere, mysql_spatial_contains, mysql_spatial_within, mysql_spatial_intersection, mysql_spatial_buffer, mysql_spatial_transform, mysql_spatial_geojson

21. security
mysql_security_audit, mysql_security_firewall_status, mysql_security_firewall_rules, mysql_security_mask_data, mysql_security_password_validate, mysql_security_ssl_status, mysql_security_user_privileges, mysql_security_sensitive_tables, mysql_security_encryption_status

22. cluster
mysql_gr_status, mysql_gr_members, mysql_gr_primary, mysql_gr_transactions, mysql_gr_flow_control, mysql_cluster_status, mysql_cluster_instances, mysql_cluster_topology, mysql_cluster_router_status, mysql_cluster_switchover

23. roles
mysql_role_list, mysql_role_create, mysql_role_drop, mysql_role_grants, mysql_role_grant, mysql_role_assign, mysql_role_revoke, mysql_user_roles

24. docstore
mysql_doc_list_collections, mysql_doc_create_collection, mysql_doc_drop_collection, mysql_doc_find, mysql_doc_add, mysql_doc_modify, mysql_doc_remove, mysql_doc_create_index, mysql_doc_collection_info

25. introspection
mysql_dependency_graph, mysql_topological_sort, mysql_cascade_simulator, mysql_schema_snapshot, mysql_constraint_analysis, mysql_migration_risks

26. migration
mysql_migration_init, mysql_migration_record, mysql_migration_apply, mysql_migration_rollback, mysql_migration_history, mysql_migration_status

27. vector
mysql_vector_store, mysql_vector_batch_store, mysql_vector_delete, mysql_vector_get, mysql_vector_search, mysql_vector_range_search, mysql_vector_hybrid_search, mysql_vector_info, mysql_vector_create_index, mysql_vector_optimize, mysql_vector_stats

28. codemode
mysql_execute_code
'''

groups = {}
current_group = None
for line in ssot_text.strip().split('\n'):
    if line.strip() == '': continue
    if line[0].isdigit():
        current_group = line.split('.')[1].strip()
        groups[current_group] = []
    else:
        groups[current_group].extend([t.strip() for t in line.split(',') if t.strip()])

all_ssot_tools = set(t for g in groups.values() for t in g)

missing = all_ssot_tools - tested_tools
print('Tools in SSoT not found as explicitly tested:', missing)


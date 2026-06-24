const fs = require('fs');
const path = require('path');

const ssot = {
  'core': ['mysql_read_query','mysql_write_query','mysql_list_tables','mysql_describe_table','mysql_create_table','mysql_drop_table','mysql_create_index','mysql_get_indexes','mysql_enable_versioning','mysql_disable_versioning','mysql_check_version','mysql_conditional_update'],
  'json': ['mysql_json_extract','mysql_json_set','mysql_json_insert','mysql_json_replace','mysql_json_remove','mysql_json_contains','mysql_json_keys','mysql_json_array_append','mysql_json_get','mysql_json_update','mysql_json_search','mysql_json_validate','mysql_json_merge','mysql_json_diff','mysql_json_normalize','mysql_json_stats','mysql_json_index_suggest'],
  'text': ['mysql_regexp_match','mysql_like_search','mysql_soundex','mysql_substring','mysql_concat','mysql_collation_convert'],
  'fulltext': ['mysql_fulltext_create','mysql_fulltext_drop','mysql_fulltext_search','mysql_fulltext_boolean','mysql_fulltext_expand'],
  'performance': ['mysql_explain','mysql_explain_analyze','mysql_slow_queries','mysql_query_stats','mysql_index_usage','mysql_table_stats','mysql_buffer_pool_stats','mysql_thread_stats','mysql_detect_query_anomalies','mysql_detect_bloat_risk','mysql_detect_connection_spike'],
  'optimization': ['mysql_index_recommendation','mysql_query_rewrite','mysql_force_index','mysql_optimizer_trace'],
  'admin': ['mysql_optimize_table','mysql_analyze_table','mysql_check_table','mysql_repair_table','mysql_flush_tables','mysql_kill_query','mysql_append_insight','mysql_server_config','mysql_audit_search'],
  'monitoring': ['mysql_show_processlist','mysql_show_status','mysql_show_variables','mysql_innodb_status','mysql_replication_status','mysql_pool_stats','mysql_server_health'],
  'backup': ['mysql_export_table','mysql_import_data','mysql_create_dump','mysql_restore_dump','mysql_audit_list_backups','mysql_audit_restore_backup','mysql_audit_diff_backup'],
  'replication': ['mysql_master_status','mysql_slave_status','mysql_binlog_events','mysql_gtid_status','mysql_replication_lag'],
  'partitioning': ['mysql_partition_info','mysql_add_partition','mysql_drop_partition','mysql_reorganize_partition'],
  'transactions': ['mysql_transaction_begin','mysql_transaction_commit','mysql_transaction_rollback','mysql_transaction_savepoint','mysql_transaction_release','mysql_transaction_rollback_to','mysql_transaction_execute'],
  'router': ['mysql_router_status','mysql_router_routes','mysql_router_route_status','mysql_router_route_health','mysql_router_route_connections','mysql_router_route_destinations','mysql_router_route_blocked_hosts','mysql_router_metadata_status','mysql_router_pool_status'],
  'proxysql': ['proxysql_status','proxysql_servers','proxysql_query_rules','proxysql_query_digest','proxysql_connection_pool','proxysql_users','proxysql_global_variables','proxysql_runtime_status','proxysql_memory_stats','proxysql_commands','proxysql_process_list'],
  'shell': ['mysqlsh_version','mysqlsh_check_upgrade','mysqlsh_export_table','mysqlsh_import_table','mysqlsh_import_json','mysqlsh_dump_instance','mysqlsh_dump_schemas','mysqlsh_dump_tables','mysqlsh_load_dump','mysqlsh_run_script'],
  'schema': ['mysql_list_schemas','mysql_create_schema','mysql_drop_schema','mysql_list_views','mysql_create_view','mysql_drop_view','mysql_list_stored_procedures','mysql_list_functions','mysql_list_triggers','mysql_list_constraints','mysql_list_events'],
  'events': ['mysql_event_create','mysql_event_alter','mysql_event_drop','mysql_event_list','mysql_event_status','mysql_scheduler_status'],
  'sysschema': ['mysql_sys_user_summary','mysql_sys_io_summary','mysql_sys_statement_summary','mysql_sys_wait_summary','mysql_sys_innodb_lock_waits','mysql_sys_schema_stats','mysql_sys_host_summary','mysql_sys_memory_summary'],
  'stats': ['mysql_stats_descriptive','mysql_stats_percentiles','mysql_stats_correlation','mysql_stats_distribution','mysql_stats_time_series','mysql_stats_regression','mysql_stats_sampling','mysql_stats_histogram','mysql_stats_row_number','mysql_stats_rank','mysql_stats_lag_lead','mysql_stats_running_total','mysql_stats_moving_avg','mysql_stats_ntile','mysql_stats_hypothesis','mysql_stats_outliers','mysql_stats_top_n','mysql_stats_distinct','mysql_stats_frequency','mysql_stats_summary'],
  'spatial': ['mysql_spatial_create_column','mysql_spatial_create_index','mysql_spatial_point','mysql_spatial_polygon','mysql_spatial_distance','mysql_spatial_distance_sphere','mysql_spatial_contains','mysql_spatial_within','mysql_spatial_intersection','mysql_spatial_buffer','mysql_spatial_transform','mysql_spatial_geojson'],
  'security': ['mysql_security_audit','mysql_security_firewall_status','mysql_security_firewall_rules','mysql_security_mask_data','mysql_security_password_validate','mysql_security_ssl_status','mysql_security_user_privileges','mysql_security_sensitive_tables','mysql_security_encryption_status'],
  'cluster': ['mysql_gr_status','mysql_gr_members','mysql_gr_primary','mysql_gr_transactions','mysql_gr_flow_control','mysql_cluster_status','mysql_cluster_instances','mysql_cluster_topology','mysql_cluster_router_status','mysql_cluster_switchover'],
  'roles': ['mysql_role_list','mysql_role_create','mysql_role_drop','mysql_role_grants','mysql_role_grant','mysql_role_assign','mysql_role_revoke','mysql_user_roles'],
  'docstore': ['mysql_doc_list_collections','mysql_doc_create_collection','mysql_doc_drop_collection','mysql_doc_find','mysql_doc_add','mysql_doc_modify','mysql_doc_remove','mysql_doc_create_index','mysql_doc_collection_info'],
  'introspection': ['mysql_dependency_graph','mysql_topological_sort','mysql_cascade_simulator','mysql_schema_snapshot','mysql_constraint_analysis','mysql_migration_risks'],
  'migration': ['mysql_migration_init','mysql_migration_record','mysql_migration_apply','mysql_migration_rollback','mysql_migration_history','mysql_migration_status'],
  'vector': ['mysql_vector_store','mysql_vector_batch_store','mysql_vector_delete','mysql_vector_get','mysql_vector_search','mysql_vector_range_search','mysql_vector_hybrid_search','mysql_vector_info','mysql_vector_create_index','mysql_vector_optimize','mysql_vector_stats'],
  'codemode': ['mysql_execute_code']
};

const dir = 'C:\\\\Users\\\\chris\\\\Desktop\\\\mysql-mcp\\\\test-server\\\\test-advanced\\\\';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md' && f !== 'coordinator-workflow.md');

// We will map which tools are tested in which files, and modify the files to explicitly list EVERY tool in its group!
// Let's actually write a script that updates the files directly.

// For each group, we find all files that start with `test-codemode-advanced-${group}` or something similar.
const groupToFile = {
  'core': ['test-codemode-advanced-core.md', 'test-codemode-advanced-versioning.md'],
  'json': ['test-codemode-advanced-json-core.md', 'test-codemode-advanced-json-enhanced.md', 'test-codemode-advanced-json-helpers.md'],
  'text': ['test-codemode-advanced-text.md'],
  'fulltext': ['test-codemode-advanced-fulltext.md'],
  'performance': ['test-codemode-advanced-performance-analysis.md', 'test-codemode-advanced-performance-anomaly.md'],
  'optimization': ['test-codemode-advanced-optimization.md'],
  'admin': ['test-codemode-advanced-admin.md'],
  'monitoring': ['test-codemode-advanced-monitoring.md'],
  'backup': ['test-codemode-advanced-backup.md'],
  'replication': ['test-codemode-advanced-replication.md'],
  'partitioning': ['test-codemode-advanced-partitioning.md'],
  'transactions': ['test-codemode-advanced-transactions.md'],
  'router': ['test-codemode-advanced-router.md'],
  'proxysql': ['test-codemode-advanced-proxysql-config.md', 'test-codemode-advanced-proxysql-status.md'],
  'shell': ['test-codemode-advanced-shell-data.md', 'test-codemode-advanced-shell-utils.md'],
  'schema': ['test-codemode-advanced-schema-management.md', 'test-codemode-advanced-schema-routines.md'],
  'events': ['test-codemode-advanced-events.md'],
  'sysschema': ['test-codemode-advanced-sys.md'],
  'stats': ['test-codemode-advanced-stats-advanced.md', 'test-codemode-advanced-stats-descriptive.md', 'test-codemode-advanced-stats-time-series.md', 'test-codemode-advanced-stats-window.md'],
  'spatial': ['test-codemode-advanced-spatial-geometry.md', 'test-codemode-advanced-spatial-operations.md', 'test-codemode-advanced-spatial-queries.md', 'test-codemode-advanced-spatial-setup.md'],
  'security': ['test-codemode-advanced-security.md'],
  'cluster': ['test-codemode-advanced-cluster-group-replication.md', 'test-codemode-advanced-cluster-innodb.md'],
  'roles': ['test-codemode-advanced-roles.md'],
  'docstore': ['test-codemode-advanced-docstore.md'],
  'introspection': ['test-codemode-advanced-introspection.md'],
  'migration': ['test-codemode-advanced-migration.md'],
  'vector': ['test-codemode-advanced-vector-management.md', 'test-codemode-advanced-vector-search.md', 'test-codemode-advanced-vector-storage.md'],
  'codemode': ['test-codemode-advanced-concurrency.md', 'test-codemode-advanced-sessions.md', 'test-codemode-sandbox.md']
};

for (const [group, tools] of Object.entries(ssot)) {
  const targetFiles = groupToFile[group];
  if (!targetFiles) {
    console.warn("No files mapped for group", group);
    continue;
  }
  
  // Distribute tools among target files. If 1 file, all tools go there. If multiple, we just split them evenly.
  // Except for some groups where certain tools make sense to group. But we can just append an "Explicit Tool Coverage" section 
  // listing a subset of tools for each file so that every tool is covered somewhere.
  
  const chunks = [];
  const filesCount = targetFiles.length;
  for (let i = 0; i < filesCount; i++) chunks.push([]);
  
  // For 'core', let's route 'versioning' tools to versioning.md, and rest to core.md.
  if (group === 'core') {
      chunks[0] = tools.filter(t => !t.includes('version'));
      chunks[1] = tools.filter(t => t.includes('version'));
  } else if (group === 'performance') {
      chunks[0] = tools.filter(t => !t.includes('anomaly') && !t.includes('risk') && !t.includes('spike'));
      chunks[1] = tools.filter(t => t.includes('anomaly') || t.includes('risk') || t.includes('spike'));
  } else if (group === 'stats') {
      chunks[0] = tools.filter(t => ['mysql_stats_ntile','mysql_stats_hypothesis','mysql_stats_outliers','mysql_stats_top_n','mysql_stats_distinct','mysql_stats_frequency','mysql_stats_summary'].includes(t));
      chunks[1] = tools.filter(t => ['mysql_stats_descriptive','mysql_stats_percentiles','mysql_stats_correlation','mysql_stats_distribution'].includes(t));
      chunks[2] = tools.filter(t => ['mysql_stats_time_series','mysql_stats_regression','mysql_stats_sampling','mysql_stats_histogram'].includes(t));
      chunks[3] = tools.filter(t => ['mysql_stats_row_number','mysql_stats_rank','mysql_stats_lag_lead','mysql_stats_running_total','mysql_stats_moving_avg'].includes(t));
  } else {
      // generic round-robin
      tools.forEach((t, i) => chunks[i % filesCount].push(t));
  }
  
  targetFiles.forEach((file, index) => {
      const p = path.join(dir, file);
      if (fs.existsSync(p)) {
          let content = fs.readFileSync(p, 'utf8');
          const toolsForFile = chunks[index];
          
          if (toolsForFile && toolsForFile.length > 0) {
              const coverageSection = "\\n\\n### Explicit Tool Coverage Requirements\\n\\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\\n\\n" + toolsForFile.map(t => "- \`" + t + "\`").join("\\n") + "\\n\\n";
              
              // Let's insert this section right before "## Tasks" or "## Category 1" or append it.
              if (!content.includes('Explicit Tool Coverage Requirements')) {
                  if (content.includes('## Tasks')) {
                      content = content.replace('## Tasks', coverageSection + '## Tasks');
                  } else if (content.includes('## Category 1:')) {
                      content = content.replace('## Category 1:', coverageSection + '## Category 1:');
                  } else if (content.includes('## Category 1')) {
                      content = content.replace('## Category 1', coverageSection + '## Category 1');
                  } else {
                      // fallback to appending before Post-Test Procedures
                      if (content.includes('## Post-Test Procedures')) {
                          content = content.replace('## Post-Test Procedures', coverageSection + '## Post-Test Procedures');
                      } else {
                          content += coverageSection;
                      }
                  }
                  fs.writeFileSync(p, content);
                  console.log(`Updated ${file} with explicit tools.`);
              }
          }
      }
  });
}

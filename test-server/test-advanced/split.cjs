const fs = require('fs');

function splitFile(filename, toolsPart1, toolsPart2) {
    if (!fs.existsSync(filename)) return;
    const text = fs.readFileSync(filename, 'utf8');
    let p1 = text.replace(/### Explicit Tool Coverage Requirements[\s\S]*?## Post-Test Procedures/g, 
        `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n${toolsPart1}\n\n## Tasks\n\n- Implement tests for the tools listed above.\n\n## Post-Test Procedures`);
    
    let p2 = text.replace(/### Explicit Tool Coverage Requirements[\s\S]*?## Post-Test Procedures/g, 
        `### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n${toolsPart2}\n\n## Tasks\n\n- Implement tests for the tools listed above.\n\n## Post-Test Procedures`);
        
    fs.writeFileSync(filename.replace('.md', '-part1.md'), p1);
    fs.writeFileSync(filename.replace('.md', '-part2.md'), p2);
    fs.unlinkSync(filename);
}

// split core
splitFile('test-codemode-advanced-core.md', 
'- `mysql_read_query`\n- `mysql_write_query`\n- `mysql_list_tables`\n- `mysql_describe_table`',
'- `mysql_create_table`\n- `mysql_drop_table`\n- `mysql_create_index`\n- `mysql_get_indexes`\n- `mysql_conditional_update`');

// split json-core
splitFile('test-codemode-advanced-json-core.md',
'- `mysql_json_extract`\n- `mysql_json_set`\n- `mysql_json_insert`\n- `mysql_json_replace`',
'- `mysql_json_remove`\n- `mysql_json_contains`\n- `mysql_json_keys`\n- `mysql_json_array_append`');

// split performance-analysis
splitFile('test-codemode-advanced-performance-analysis.md',
'- `mysql_explain`\n- `mysql_explain_analyze`\n- `mysql_slow_queries`\n- `mysql_query_stats`\n- `mysql_index_usage`',
'- `mysql_table_stats`\n- `mysql_buffer_pool_stats`\n- `mysql_thread_stats`\n- `mysql_detect_query_anomalies`');

// split shell-utils
splitFile('test-codemode-advanced-shell-utils.md',
'- `mysqlsh_version`\n- `mysqlsh_check_upgrade`\n- `mysqlsh_export_table`\n- `mysqlsh_import_table`\n- `mysqlsh_import_json`',
'- `mysqlsh_dump_instance`\n- `mysqlsh_dump_schemas`\n- `mysqlsh_dump_tables`\n- `mysqlsh_load_dump`');

// split sys
splitFile('test-codemode-advanced-sys.md',
'- `mysql_sys_user_summary`\n- `mysql_sys_io_summary`\n- `mysql_sys_statement_summary`\n- `mysql_sys_wait_summary`',
'- `mysql_sys_innodb_lock_waits`\n- `mysql_sys_schema_stats`\n- `mysql_sys_host_summary`\n- `mysql_sys_memory_summary`');

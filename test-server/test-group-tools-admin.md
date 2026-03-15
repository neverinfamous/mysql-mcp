# Group-Specific Tool Testing — Admin, Monitoring, Performance, Security, Backup, Replication, sys, Optimization, Roles

### admin Group-Specific Testing

admin Tool Group (6 tools +1 for code mode):

1. 'mysql_optimize_table'
2. 'mysql_analyze_table'
3. 'mysql_check_table'
4. 'mysql_repair_table'
5. 'mysql_flush_tables'
6. 'mysql_kill_query'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_analyze_table({table: "test_products"})` → `{success: true}`
2. `mysql_check_table({table: "test_products"})` → verify `status: "OK"`
3. `mysql_optimize_table({table: "test_products"})` → verify success response
4. `mysql_kill_query({id: 99999})` → `{success: false}` or structured error (invalid process ID)
5. 🔴 `mysql_analyze_table({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` handler error
6. 🔴 `mysql_analyze_table({})` → `{success: false, error: "..."}` (Zod validation)
7. 🔴 `mysql_kill_query({id: "abc"})` → must NOT return raw MCP error (wrong-type numeric param)

---

### monitoring Group-Specific Testing

monitoring Tool Group (7 tools +1 for code mode):

1. 'mysql_show_processlist'
2. 'mysql_show_status'
3. 'mysql_show_variables'
4. 'mysql_innodb_status'
5. 'mysql_replication_status'
6. 'mysql_pool_stats'
7. 'mysql_server_health'
8. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_show_processlist()` → verify at least 1 active connection
2. `mysql_show_status({like: "Uptime"})` → verify `Uptime > 0`
3. `mysql_show_variables({like: "max_connections"})` → verify numeric value
4. `mysql_innodb_status()` → verify InnoDB status output
5. `mysql_innodb_status({summary: true})` → verify summarized output (smaller payload)
6. `mysql_pool_stats()` → verify connection pool statistics
7. `mysql_server_health()` → verify `{status: "..."}` with health assessment
8. 🔴 `mysql_show_status({like: "nonexistent_var_xyz"})` → empty results or structured error — not raw MCP error
9. 🔴 `mysql_show_variables({limit: "abc"})` → must NOT return raw MCP error (wrong-type numeric param)

**Code mode parity:**

10. `mysql_execute_code({code: "return await mysql.monitoring.help()"})` → verify lists monitoring methods

---

### performance Group-Specific Testing

performance Tool Group (8 tools +1 for code mode):

1. 'mysql_explain'
2. 'mysql_explain_analyze'
3. 'mysql_slow_queries'
4. 'mysql_query_stats'
5. 'mysql_index_usage'
6. 'mysql_table_stats'
7. 'mysql_buffer_pool_stats'
8. 'mysql_thread_stats'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_explain({query: "SELECT * FROM test_products WHERE id = 1"})` → verify execution plan returned
2. `mysql_explain({query: "SELECT * FROM test_products WHERE id = 1", format: "JSON"})` → verify JSON-format plan
3. `mysql_table_stats({table: "test_products"})` → verify `{rows, avgRowLength, dataLength}` present
4. `mysql_index_usage({table: "test_products"})` → verify index usage statistics
5. `mysql_buffer_pool_stats()` → verify buffer pool metrics
6. `mysql_thread_stats()` → verify thread statistics
7. `mysql_query_stats({limit: 3})` → verify top query statistics

**Domain error paths (🔴):**

8. 🔴 `mysql_table_stats({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error (P154)
9. 🔴 `mysql_explain({query: "SELEKT * FROM test_products"})` → `{success: false, error: "..."}` syntax error

**Zod validation error paths (🔴):**

10. 🔴 `mysql_explain({})` → `{success: false, error: "..."}` (missing required `query`)
11. 🔴 `mysql_table_stats({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

12. 🔴 `mysql_query_stats({limit: "abc"})` → must NOT return raw MCP error
13. 🔴 `mysql_slow_queries({limit: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

14. `mysql_execute_code({code: "return await mysql.performance.help()"})` → verify lists performance methods

---

### optimization Group-Specific Testing

optimization Tool Group (4 tools +1 for code mode):

1. 'mysql_index_recommendation'
2. 'mysql_query_rewrite'
3. 'mysql_force_index'
4. 'mysql_optimizer_trace'
5. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysql_index_recommendation({table: "test_orders"})` → verify recommendations returned
2. `mysql_query_rewrite({query: "SELECT * FROM test_products WHERE name = 'Laptop'"})` → verify optimization hints
3. `mysql_force_index({table: "test_orders", index: "idx_orders_status", query: "SELECT * FROM test_orders WHERE status = 'completed'"})` → verify FORCE INDEX hint
4. `mysql_optimizer_trace({query: "SELECT * FROM test_products WHERE id = 1"})` → verify trace output
5. `mysql_optimizer_trace({query: "SELECT * FROM test_products WHERE id = 1", summary: true})` → verify summarized trace
6. 🔴 `mysql_index_recommendation({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_index_recommendation({})` → `{success: false, error: "..."}` (Zod validation)
8. 🔴 `mysql_optimizer_trace({})` → `{success: false, error: "..."}` (missing required `query`)

---

### security Group-Specific Testing

security Tool Group (9 tools +1 for code mode):

1. 'mysql_security_audit'
2. 'mysql_security_firewall_status'
3. 'mysql_security_firewall_rules'
4. 'mysql_security_mask_data'
5. 'mysql_security_password_validate'
6. 'mysql_security_ssl_status'
7. 'mysql_security_user_privileges'
8. 'mysql_security_sensitive_tables'
9. 'mysql_security_encryption_status'
10. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysql_security_audit()` → verify audit results with privilege analysis
2. `mysql_security_ssl_status()` → verify SSL/TLS status information
3. `mysql_security_user_privileges({user: "root"})` → verify privileges listed
4. `mysql_security_user_privileges({user: "root", summary: true})` → verify summarized output
5. `mysql_security_sensitive_tables({database: "testdb"})` → verify scan results
6. `mysql_security_password_validate({password: "weak"})` → verify strength assessment (should flag as weak)
7. `mysql_security_password_validate({password: "Str0ng!Pass#2026"})` → verify passes validation
8. `mysql_security_encryption_status()` → verify encryption status
9. 🔴 `mysql_security_user_privileges({user: "nonexistent_user_xyz"})` → `{success: false, error: "..."}` or empty results
10. 🔴 `mysql_security_password_validate({})` → `{success: false, error: "..."}` (Zod validation)

---

### roles Group-Specific Testing

roles Tool Group (8 tools +1 for code mode):

1. 'mysql_role_list'
2. 'mysql_role_create'
3. 'mysql_role_drop'
4. 'mysql_role_grants'
5. 'mysql_role_grant'
6. 'mysql_role_assign'
7. 'mysql_role_revoke'
8. 'mysql_user_roles'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysql_role_list()` → verify response structure (may be empty list)
2. `mysql_user_roles({user: "root"})` → verify roles listed for root

**Create → Use → Drop lifecycle:**

3. `mysql_role_create({name: "temp_test_role"})` → `{success: true}`
4. `mysql_role_grants({role: "temp_test_role"})` → verify empty grants
5. `mysql_role_drop({name: "temp_test_role"})` → `{success: true}`

**Domain error paths (🔴):**

6. 🔴 `mysql_role_drop({name: "nonexistent_role_xyz"})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_role_grants({role: "nonexistent_role_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

8. 🔴 `mysql_role_create({})` → `{success: false, error: "..."}` (missing required `name`)
9. 🔴 `mysql_role_drop({})` → `{success: false, error: "..."}` (missing required `name`)

---

### backup Group-Specific Testing

backup Tool Group (4 tools +1 for code mode):

1. 'mysql_export_table'
2. 'mysql_import_data'
3. 'mysql_create_dump'
4. 'mysql_restore_dump'
5. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysql_export_table({table: "test_products", limit: 3})` → verify 3 rows exported
2. `mysql_export_table({table: "test_products", format: "csv", limit: 5})` → verify CSV format
3. `mysql_create_dump({tables: ["test_products"], database: "testdb"})` → verify dump command generated

**Domain error paths (🔴):**

4. 🔴 `mysql_export_table({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error
5. 🔴 `mysql_restore_dump({})` → `{success: false, error: "..."}` (Zod validation — missing required params)

**Wrong-type numeric param coercion (🔴):**

6. 🔴 `mysql_export_table({table: "test_products", limit: "abc"})` → must NOT return raw MCP error

---

### replication Group-Specific Testing

replication Tool Group (5 tools +1 for code mode):

1. 'mysql_master_status'
2. 'mysql_slave_status'
3. 'mysql_binlog_events'
4. 'mysql_gtid_status'
5. 'mysql_replication_lag'
6. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

> **Note:** Replication tools may return partial data on standalone MySQL instances — this is expected.

1. `mysql_master_status()` → verify binlog position or structured response
2. `mysql_gtid_status()` → verify GTID information
3. `mysql_binlog_events({limit: 3})` → verify events or empty response
4. 🔴 `mysql_binlog_events({limit: "abc"})` → must NOT return raw MCP error (wrong-type numeric param)

**Code mode parity:**

5. `mysql_execute_code({code: "return await mysql.replication.help()"})` → verify lists replication methods

---

### sys Group-Specific Testing

sys Tool Group (8 tools +1 for code mode):

1. 'mysql_sys_user_summary'
2. 'mysql_sys_io_summary'
3. 'mysql_sys_statement_summary'
4. 'mysql_sys_wait_summary'
5. 'mysql_sys_innodb_lock_waits'
6. 'mysql_sys_schema_stats'
7. 'mysql_sys_host_summary'
8. 'mysql_sys_memory_summary'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysql_sys_user_summary()` → verify user resource usage data
2. `mysql_sys_statement_summary({limit: 3})` → verify top statements returned
3. `mysql_sys_schema_stats({database: "testdb"})` → verify table/index sizes
4. `mysql_sys_memory_summary()` → verify memory usage breakdown
5. `mysql_sys_io_summary()` → verify I/O statistics
6. 🔴 `mysql_sys_statement_summary({limit: "abc"})` → must NOT return raw MCP error (wrong-type numeric param)

**Code mode parity:**

7. `mysql_execute_code({code: "return await mysql.sys.help()"})` → verify lists sys methods


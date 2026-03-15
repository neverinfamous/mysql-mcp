# Group-Specific Tool Testing — Ecosystem (Cluster, ProxySQL, Router, Shell)

> **Note:** Most ecosystem tools require specialized infrastructure (InnoDB Cluster, ProxySQL container, MySQL Router, MySQL Shell). See `C:\Users\chris\Desktop\adamic\docs\mysql-ecosystem-docker-setup.md` for setup. Tests that fail due to missing infrastructure should be noted as ⚠️ (infrastructure-dependent), not ❌.

### cluster Group-Specific Testing

cluster Tool Group (10 tools +1 for code mode):

1. 'mysql_gr_status'
2. 'mysql_gr_members'
3. 'mysql_gr_primary'
4. 'mysql_gr_transactions'
5. 'mysql_gr_flow_control'
6. 'mysql_cluster_status'
7. 'mysql_cluster_instances'
8. 'mysql_cluster_topology'
9. 'mysql_cluster_router_status'
10. 'mysql_cluster_switchover'
11. 'mysql_execute_code' (codemode, auto-added)

> **Prerequisites**: InnoDB Cluster infrastructure. Connect to cluster node (port 3307, not 3306).

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

1. `mysql_gr_status()` → verify `{groupReplicationEnabled: boolean}` or structured error if GR not running
2. `mysql_cluster_status()` → verify cluster status or `{success: false}` if not in cluster
3. `mysql_cluster_status({summary: true})` → verify summarized output (smaller payload)
4. `mysql_cluster_instances()` → verify instance list or structured error
5. `mysql_cluster_topology()` → verify topology map or structured error
6. `mysql_cluster_router_status()` → verify router status if available
7. `mysql_cluster_router_status({summary: true})` → verify summarized output

**Domain error paths (🔴):**

8. 🔴 `mysql_gr_status()` on standalone → verify returns structured `{groupReplicationEnabled: false}` — NOT raw MCP error
9. 🔴 `mysql_cluster_switchover({})` → `{success: false, error: "..."}` (Zod validation or readiness check failure)

**Code mode parity:**

10. `mysql_execute_code({code: "return await mysql.cluster.help()"})` → verify lists cluster methods

---

### proxysql Group-Specific Testing

proxysql Tool Group (11 tools +1 for code mode):

1. 'proxysql_status'
2. 'proxysql_servers'
3. 'proxysql_query_rules'
4. 'proxysql_query_digest'
5. 'proxysql_connection_pool'
6. 'proxysql_users'
7. 'proxysql_global_variables'
8. 'proxysql_runtime_status'
9. 'proxysql_memory_stats'
10. 'proxysql_commands'
11. 'proxysql_process_list'
12. 'mysql_execute_code' (codemode, auto-added)

> **Prerequisites**: ProxySQL container running. Admin on port 6032 with radmin/radmin.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `proxysql_status()` → verify `{version, uptime}` or structured error if proxy not running
2. `proxysql_status({summary: true})` → verify summarized output
3. `proxysql_servers()` → verify backend server list
4. `proxysql_query_rules()` → verify routing rules
5. `proxysql_connection_pool()` → verify pool statistics
6. `proxysql_users()` → verify user list (credentials should be redacted)
7. `proxysql_global_variables({limit: 5})` → verify limited variable list (credentials redacted)
8. `proxysql_global_variables({like: "mysql-max_connections"})` → verify filtered results
9. `proxysql_runtime_status()` → verify runtime config
10. `proxysql_runtime_status({summary: true})` → verify summarized (credentials redacted)
11. `proxysql_memory_stats()` → verify memory breakdown

**Domain error paths (🔴):**

12. 🔴 All ProxySQL tools when proxy is not running → must return `{success: false, error: "..."}` — NOT raw MCP error

**Wrong-type numeric param coercion (🔴):**

13. 🔴 `proxysql_global_variables({limit: "abc"})` → must NOT return raw MCP error
14. 🔴 `proxysql_query_digest({limit: "abc"})` → must NOT return raw MCP error

**Code mode parity:**

15. `mysql_execute_code({code: "return await mysql.proxysql.help()"})` → verify lists proxysql methods

---

### router Group-Specific Testing

router Tool Group (9 tools +1 for code mode):

1. 'mysql_router_status'
2. 'mysql_router_routes'
3. 'mysql_router_route_status'
4. 'mysql_router_route_health'
5. 'mysql_router_route_connections'
6. 'mysql_router_route_destinations'
7. 'mysql_router_route_blocked_hosts'
8. 'mysql_router_metadata_status'
9. 'mysql_router_pool_status'
10. 'mysql_execute_code' (codemode, auto-added)

> **Prerequisites**: MySQL Router 8.0.17+ with REST API enabled. HTTPS on port 8443 with `MYSQL_ROUTER_INSECURE=true`. Requires InnoDB Cluster.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysql_router_status()` → verify `{version, processInfo}` or structured error
2. `mysql_router_routes()` → verify list of configured routes or structured error
3. `mysql_router_route_status({routeName: <name from item 2>})` → verify route status
4. `mysql_router_route_health({routeName: <name from item 2>})` → verify health status
5. `mysql_router_route_destinations({routeName: <name from item 2>})` → verify backend destinations

**Domain error paths (🔴):**

6. 🔴 `mysql_router_route_status({routeName: "nonexistent_route_xyz"})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_router_status()` when router is not running → must return structured error — NOT raw MCP error

**Zod validation error paths (🔴):**

8. 🔴 `mysql_router_route_status({})` → `{success: false, error: "..."}` (missing required `routeName`)
9. 🔴 `mysql_router_metadata_status({})` → `{success: false, error: "..."}` (missing required `metadataName`)

**Code mode parity:**

10. `mysql_execute_code({code: "return await mysql.router.help()"})` → verify lists router methods

---

### shell Group-Specific Testing

shell Tool Group (10 tools +1 for code mode):

1. 'mysqlsh_version'
2. 'mysqlsh_check_upgrade'
3. 'mysqlsh_export_table'
4. 'mysqlsh_import_table'
5. 'mysqlsh_import_json'
6. 'mysqlsh_dump_instance'
7. 'mysqlsh_dump_schemas'
8. 'mysqlsh_dump_tables'
9. 'mysqlsh_load_dump'
10. 'mysqlsh_run_script'
11. 'mysql_execute_code' (codemode, auto-added)

> **Prerequisites**: MySQL Shell 8.0+ installed.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown. Compare responses against the expected results. Report any deviation.

1. `mysqlsh_version()` → verify `{installed: boolean, version: "..."}` or installation status
2. `mysqlsh_check_upgrade()` → verify upgrade compatibility report or structured error if shell not installed

**Export/Import lifecycle (if shell is installed):**

3. `mysqlsh_dump_tables({schema: "testdb", tables: ["test_products"]})` → verify dump command or structured output
4. `mysqlsh_dump_schemas({schemas: ["testdb"], ddlOnly: true})` → verify DDL-only dump

**Domain error paths (🔴):**

5. 🔴 `mysqlsh_dump_tables({schema: "nonexistent_db_xyz", tables: ["t"]})` → `{success: false, error: "..."}` handler error
6. 🔴 `mysqlsh_version()` when shell is not installed → verify graceful structured response (not raw error)

**Zod validation error paths (🔴):**

7. 🔴 `mysqlsh_dump_tables({})` → `{success: false, error: "..."}` (missing required params)
8. 🔴 `mysqlsh_run_script({})` → `{success: false, error: "..."}` (missing required params)

**Code mode parity:**

9. `mysql_execute_code({code: "return await mysql.shell.help()"})` → verify lists shell methods


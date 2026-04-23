# mysql-mcp Code Mode Re-Testing: [proxysql]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Infrastructure Prerequisite

> **Note:** Requires running ProxySQL admin interface. Configure `mysql-ecosystem` MCP server with `--proxysql-*` parameters.

## Requirements

1. **Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.
3. Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: proxysql

proxysql Tool Group (11 tools +1 code mode):

1. `proxysql_status` 2. `proxysql_servers` 3. `proxysql_query_rules`
4. `proxysql_query_digest` 5. `proxysql_connection_pool` 6. `proxysql_users`
7. `proxysql_global_variables` 8. `proxysql_runtime_status` 9. `proxysql_memory_stats`
10. `proxysql_commands` 11. `proxysql_process_list`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.proxysql.help()` → verify method listing
2. `mysql.proxysql.status()` → version, uptime
3. `mysql.proxysql.status({summary: true})` → summarized
4. `mysql.proxysql.servers()` → backend listing
5. `mysql.proxysql.queryRules()` → routing rules
6. `mysql.proxysql.connectionPool()` → pool stats
7. `mysql.proxysql.users()` → user listing
8. `mysql.proxysql.globalVariables({limit: 10})` → first 10
9. `mysql.proxysql.runtimeStatus()` → runtime config
10. `mysql.proxysql.runtimeStatus({summary: true})` → summarized
11. `mysql.proxysql.memoryStats()` → memory
12. `mysql.proxysql.processList()` → sessions
13. `mysql.proxysql.queryDigest({limit: 5})` → top queries

**Zod validation error paths (🔴):**

14. 🔴 `mysql.proxysql.commands({})` → `{success: false, error: "Validation error: ..."}`

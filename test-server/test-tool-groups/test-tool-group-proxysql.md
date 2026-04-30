# mysql-mcp Tool Group Testing: [proxysql]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Infrastructure Prerequisite

> **Note:** The ProxySQL tools require a running ProxySQL admin interface. Configure the `mysql-ecosystem` MCP server entry with `--proxysql-*` parameters and ensure the ProxySQL container is active before running these tests. In a non-ProxySQL environment, these tools should return structured errors — NOT raw MCP exceptions.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: proxysql

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

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `proxysql_status()` → verify ProxySQL version, uptime
2. `proxysql_status({summary: true})` → verify summarized output
3. `proxysql_servers()` → verify backend server listing
4. `proxysql_query_rules()` → verify query routing rules
5. `proxysql_connection_pool()` → verify pool statistics
6. `proxysql_users()` → verify user listing
7. `proxysql_global_variables({limit: 10})` → verify first 10 variables
8. `proxysql_global_variables({like: "mysql-max_connections"})` → verify specific variable
9. `proxysql_runtime_status()` → verify runtime configuration
10. `proxysql_runtime_status({summary: true})` → verify summarized output
11. `proxysql_memory_stats()` → verify memory usage
12. `proxysql_process_list()` → verify active sessions
13. `proxysql_query_digest({limit: 5})` → verify top queries

**Zod validation error paths (🔴):**

14. 🔴 `proxysql_commands({})` → `{success: false, error: "..."}` (Zod validation — missing required `command`)

**Wrong-type numeric param coercion (🔴):**

15. 🔴 `proxysql_query_digest({limit: "abc"})` → must NOT return raw MCP error

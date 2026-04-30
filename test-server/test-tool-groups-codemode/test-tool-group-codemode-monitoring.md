# mysql-mcp Code Mode Re-Testing: [monitoring]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

---

## Group Focus: monitoring

monitoring Tool Group (7 tools +1 code mode):

1. `mysql_show_processlist` 2. `mysql_show_status` 3. `mysql_show_variables`
2. `mysql_innodb_status` 5. `mysql_replication_status` 6. `mysql_pool_stats`
3. `mysql_server_health`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.monitoring.help()` → verify method listing
2. `mysql.monitoring.showProcesslist()` → at least 1 connection
3. `mysql.monitoring.showStatus({like: "Uptime"})` → Uptime > 0
4. `mysql.monitoring.showVariables({like: "max_connections"})` → numeric value
5. `mysql.monitoring.innodbStatus()` → InnoDB status
6. `mysql.monitoring.innodbStatus({summary: true})` → summarized output (smaller payload)
7. `mysql.monitoring.poolStats()` → connection pool stats
8. `mysql.monitoring.serverHealth()` → health assessment

**Domain error paths (🔴):**

9. 🔴 `mysql.monitoring.showStatus({like: "nonexistent_var_xyz"})` → empty or structured response

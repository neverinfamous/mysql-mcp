# mysql-mcp Code Mode Re-Testing: [monitoring]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: monitoring

monitoring Tool Group (7 tools +1 code mode):

1. `mysql_show_processlist` 2. `mysql_show_status` 3. `mysql_show_variables`
4. `mysql_innodb_status` 5. `mysql_replication_status` 6. `mysql_pool_stats`
7. `mysql_server_health`

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

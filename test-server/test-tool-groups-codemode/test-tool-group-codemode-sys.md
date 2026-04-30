# mysql-mcp Code Mode Re-Testing: [sys]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: sys

sys Tool Group (8 tools +1 code mode):

1. `mysql_sys_user_summary` 2. `mysql_sys_io_summary` 3. `mysql_sys_statement_summary`
4. `mysql_sys_wait_summary` 5. `mysql_sys_innodb_lock_waits` 6. `mysql_sys_schema_stats`
7. `mysql_sys_host_summary` 8. `mysql_sys_memory_summary`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.sys.help()` → verify method listing
2. `mysql.sys.userSummary()` → user resource usage
3. `mysql.sys.ioSummary()` → I/O metrics
4. `mysql.sys.statementSummary()` → statement analysis
5. `mysql.sys.waitSummary()` → wait events
6. `mysql.sys.innodbLockWaits()` → lock info (may be empty)
7. `mysql.sys.schemaStats()` → table/index sizes
8. `mysql.sys.hostSummary()` → host metrics
9. `mysql.sys.memorySummary()` → memory usage

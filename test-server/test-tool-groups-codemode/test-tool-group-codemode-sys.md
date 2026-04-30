# mysql-mcp Code Mode Re-Testing: [sys]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

---

## Group Focus: sys

sys Tool Group (8 tools +1 code mode):

1. `mysql_sys_user_summary` 2. `mysql_sys_io_summary` 3. `mysql_sys_statement_summary`
2. `mysql_sys_wait_summary` 5. `mysql_sys_innodb_lock_waits` 6. `mysql_sys_schema_stats`
3. `mysql_sys_host_summary` 8. `mysql_sys_memory_summary`

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

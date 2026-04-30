# mysql-mcp Code Mode Re-Testing: [performance]

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

## Group Focus: performance

performance Tool Group (11 tools +1 code mode):

1. `mysql_explain` 2. `mysql_explain_analyze` 3. `mysql_slow_queries`
2. `mysql_query_stats` 5. `mysql_index_usage` 6. `mysql_table_stats`
3. `mysql_buffer_pool_stats` 8. `mysql_thread_stats` 9. `mysql_detect_query_anomalies`
4. `mysql_detect_bloat_risk` 11. `mysql_detect_connection_spike`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.performance.help()` → verify method listing
2. `mysql.performance.explain({query: "SELECT * FROM test_products WHERE id = 1"})` → execution plan
3. `mysql.performance.explain({query: "SELECT * FROM test_products WHERE id = 1", format: "JSON"})` → JSON plan
4. `mysql.performance.tableStats({table: "test_products"})` → rows, dataLength
5. `mysql.performance.indexUsage({table: "test_products"})` → index stats
6. `mysql.performance.bufferPoolStats()` → buffer pool metrics
7. `mysql.performance.threadStats()` → thread statistics
8. `mysql.performance.queryStats({limit: 3})` → top queries
9. `mysql.performance.detectQueryAnomalies()` → query anomalies
10. `mysql.performance.detectBloatRisk()` → table bloat risks
11. `mysql.performance.detectConnectionSpike()` → connection spike risks

**Domain error paths (🔴):**

12. 🔴 `mysql.performance.tableStats({table: "nonexistent_xyz"})` → `{success: false}` (P154)
13. 🔴 `mysql.performance.explain({query: "SELEKT * FROM test_products"})` → `{success: false}` syntax error

**Zod validation error paths (🔴):**

14. 🔴 `mysql.performance.explain({})` → `{success: false, error: "Validation error: ..."}`
15. 🔴 `mysql.performance.tableStats({})` → `{success: false, error: "Validation error: ..."}`
16. 🔴 `mysql.performance.detectQueryAnomalies({minExecutions: "invalid"})` → `{success: false, error: "Validation error: ..."}`

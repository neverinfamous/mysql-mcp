# mysql-mcp Code Mode Re-Testing: [admin]

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

## Group Focus: admin

admin Tool Group (6 tools +1 code mode):

1. `mysql_optimize_table` 2. `mysql_analyze_table` 3. `mysql_check_table`
2. `mysql_repair_table` 5. `mysql_flush_tables` 6. `mysql_kill_query`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.admin.help()` → verify method listing
2. `mysql.admin.analyzeTable({table: "test_products"})` → `success: true`
3. `mysql.admin.checkTable({table: "test_products"})` → status OK
4. `mysql.admin.optimizeTable({table: "test_products"})` → success
5. `mysql.admin.killQuery({id: 99999})` → structured error (invalid PID)

**Domain error paths (🔴):**

6. 🔴 `mysql.admin.analyzeTable({table: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

7. 🔴 `mysql.admin.analyzeTable({})` → `{success: false, error: "Validation error: ..."}`

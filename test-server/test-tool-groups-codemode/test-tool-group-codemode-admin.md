# mysql-mcp Code Mode Re-Testing: [admin]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: admin

admin Tool Group (6 tools +1 code mode):

1. `mysql_optimize_table` 2. `mysql_analyze_table` 3. `mysql_check_table`
4. `mysql_repair_table` 5. `mysql_flush_tables` 6. `mysql_kill_query`

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

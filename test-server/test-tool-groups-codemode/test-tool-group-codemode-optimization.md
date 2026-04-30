# mysql-mcp Code Mode Re-Testing: [optimization]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: optimization

optimization Tool Group (4 tools +1 code mode):

1. `mysql_index_recommendation` 2. `mysql_query_rewrite` 3. `mysql_force_index`
4. `mysql_optimizer_trace`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.optimization.help()` → verify method listing
2. `mysql.optimization.indexRecommendation({table: "test_orders"})` → recommendations
3. `mysql.optimization.queryRewrite({query: "SELECT * FROM test_products WHERE name = 'Laptop'"})` → hints
4. `mysql.optimization.forceIndex({table: "test_orders", index: "idx_orders_status", query: "SELECT * FROM test_orders WHERE status = 'completed'"})` → FORCE INDEX hint
5. `mysql.optimization.optimizerTrace({query: "SELECT * FROM test_products WHERE id = 1"})` → trace
6. `mysql.optimization.optimizerTrace({query: "SELECT * FROM test_products WHERE id = 1", summary: true})` → summarized

**Domain error paths (🔴):**

7. 🔴 `mysql.optimization.indexRecommendation({table: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

8. 🔴 `mysql.optimization.indexRecommendation({})` → `{success: false, error: "Validation error: ..."}`
9. 🔴 `mysql.optimization.optimizerTrace({})` → `{success: false, error: "Validation error: ..."}`

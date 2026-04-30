# mysql-mcp Code Mode Re-Testing: [optimization]

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

## Group Focus: optimization

optimization Tool Group (4 tools +1 code mode):

1. `mysql_index_recommendation` 2. `mysql_query_rewrite` 3. `mysql_force_index`
2. `mysql_optimizer_trace`

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

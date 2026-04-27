# mysql-mcp Advanced Stress Tests: [optimization]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-optimization.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` tables and indexes. Fix findings, update changelog, commit without pushing.

---

## Category 1: Complex Query Rewrites

1. `mysql_query_rewrite` with a subquery: `"SELECT * FROM test_products WHERE id IN (SELECT product_id FROM test_orders)"` → verify rewrite suggestions
2. `mysql_query_rewrite` with a multi-table JOIN: `"SELECT p.name, o.status FROM test_products p JOIN test_orders o ON p.id = o.product_id WHERE o.status = 'completed'"` → verify hints
3. `mysql_query_rewrite` with `SELECT *` anti-pattern → verify recommendation to specify columns

## Category 2: Optimizer Trace Payload

4. `mysql_optimizer_trace({query: "SELECT * FROM test_products WHERE id = 1"})` → log token estimate (full)
5. `mysql_optimizer_trace({query: "SELECT * FROM test_products WHERE id = 1", summary: true})` → log token estimate (summary)
6. Verify summary token estimate is ≥ 30% smaller than full trace
7. `mysql_optimizer_trace` with complex JOIN query → log token estimate, flag > 500 tokens as 📦

## Category 3: Force Index Edge Cases

8. `mysql_force_index({table: "test_orders", index: "nonexistent_idx_xyz", query: "SELECT * FROM test_orders"})` → verify structured `{success: false}`
9. `mysql_force_index({table: "nonexistent_xyz", index: "idx_orders_status", query: "SELECT * FROM test_orders"})` → verify structured `{success: false}`
10. `mysql_force_index` with valid table/index but query referencing a different table → verify behavior

## Category 4: Index Recommendation Comparison

11. `mysql_index_recommendation({table: "test_orders"})` → log recommendations (table has indexes)
12. Create `stress_no_idx` table with columns but no indexes, insert 10 rows
13. `mysql_index_recommendation({table: "stress_no_idx"})` → verify recommendations differ from indexed table
14. Verify recommendations include actionable column suggestions

## Cleanup

15. Drop all `stress_*` tables

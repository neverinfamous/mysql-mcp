# mysql-mcp Advanced Stress Tests: [optimization]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity    | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                 | —                   |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type                 | What you see                                     | Verdict            |
| -------------------- | ------------------------------------------------ | ------------------ |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct            |
| **MCP error** ❌     | Raw error string, no `success` field             | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

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

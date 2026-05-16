# mysql-mcp Advanced Stress Tests: [schema]

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
| `test_categories`   | 17   | id, name, path, level                             | —                   |

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-schema.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` schemas, views, and objects. Fix findings, update changelog, commit without pushing.

---

## Category 1: DDL Idempotency

1. `mysql_create_schema({name: "stress_schema_dup"})` → success
2. `mysql_create_schema({name: "stress_schema_dup"})` again → verify structured `{success: false}` (duplicate)
3. `mysql_drop_schema({name: "stress_schema_dup"})` → success
4. `mysql_drop_schema({name: "stress_schema_dup"})` again → verify structured `{success: false}` (already dropped)
5. Create view `stress_view_dup` on `test_products`, then create again with same name → verify structured error
6. Drop the view, recreate it → verify clean slate (no leftover state)

## Category 2: Cross-Object Dependencies

7. Create view `stress_dep_view` joining `test_orders` and `test_products` on FK → verify success
8. `mysql_list_constraints({table: "test_orders"})` → verify FK to `test_products` is visible
9. Create a view referencing a subquery with aggregation → verify `createView` handles complex SQL
10. Drop the dependent view → verify clean removal

## Category 3: Parameter Alias Stress

11. `mysql_list_constraints` with `database` param → verify identical to `schema` param
12. `mysql_create_view` with `query` param → verify identical to `definition` param
13. `mysql_list_views` with `database` param → verify response matches `schema` param

## Category 4: Payload Monitoring

14. `mysql_list_constraints({table: "test_orders"})` → log token estimate
15. `mysql_list_triggers({database: "testdb"})` → log token estimate
16. `mysql_list_stored_procedures({database: "testdb"})` → log token estimate
17. Flag any response > 500 tokens as 📦

## Cleanup

18. Drop all `stress_*` schemas and views

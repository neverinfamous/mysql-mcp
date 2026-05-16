# mysql-mcp Advanced Stress Tests: [introspection]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-introspection.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Deep Hierarchy & Traversal Limits

1. Create a schema `stress_hierarchies` with 10 sequentially linked tables (`t1` -> `t2` -> ... -> `t10`).
2. Run `mysql_dependency_graph` with `maxDepth: 1` — verify it truncates traversal early.
3. Run `mysql_dependency_graph` with `maxDepth: 20` — verify it successfully traverses the full chain without stack overflow.
4. Run `mysql_topological_sort` on `stress_hierarchies` — verify strict creation order `t1, t2, ..., t10` is returned.

## Category 2: Circular Dependency Handling

5. Create a schema `stress_circular` with tables `A` and `B`, where `A` references `B` and `B` references `A`.
6. Run `mysql_dependency_graph` on `stress_circular` — verify it terminates cleanly without infinite loops (check output payload size).
7. Run `mysql_constraint_analysis` on `stress_circular` — verify it explicitly flags the circular reference in its findings.
8. Run `mysql_topological_sort` on `stress_circular` — verify it returns a structured `{success: false, error: "..."}` explicitly citing a circular dependency cycle.

## Category 3: Complex Cascade Simulation

9. In `stress_hierarchies`, add a `ON DELETE CASCADE` rule from `t1` all the way down to `t10`.
10. Insert 1 row into `t1`, cascading 1 row into each subsequent table.
11. Run `mysql_cascade_simulator` with `operation: DELETE` on `t1` — verify it accurately traces the deletion cascade through all 10 tables.
12. Modify the constraint on `t5` to `ON DELETE RESTRICT`. Run `mysql_cascade_simulator` again — verify it correctly flags the operation as blocked at `t5`.

## Category 4: Cleanup Verification

13. Drop schemas `stress_hierarchies` and `stress_circular`. Verify clean removal.

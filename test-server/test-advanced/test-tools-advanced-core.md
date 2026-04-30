# mysql-mcp Advanced Stress Tests: [core]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|---|---|---|---|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_json_docs` | 8 | id, doc, metadata, tags | doc, metadata, tags |
| `test_articles` | 10 | id, title, body, author (FULLTEXT) | — |
| `test_users` | 10 | id, username, email, phone, bio, role | — |
| `test_measurements` | 200 | id, sensor_id (INT 1-5), temperature, humidity | — |
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT) | — |
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, \_id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |
| `test_categories` | 17 | id, name, parent_id (FK self-ref) | — |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type | What you see | Verdict |
|---|---|---|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw error string, no `success` field | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

## Pre-requisites

- Basic deterministic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-core.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Boundary Values

1. Insert MAX INT, MIN INT, 0, NULL into a `stress_boundary` table
2. Test VARCHAR with empty string `''`, max length string, and NULL
3. Test DECIMAL with very large/small values
4. Test DATE with `0000-00-00`, `9999-12-31`
5. Query empty table (0 rows) — verify response shape is consistent

## Category 2: State Pollution

6. Create `stress_pollution` table, insert rows, verify count
7. Drop and recreate same table — verify no row leakage
8. Create table with same name as a dropped table — verify clean slate
9. Insert duplicate primary key — verify structured error
10. Insert NULL into NOT NULL column — verify structured error

## Category 3: Idempotency

11. Call `mysql_create_table` for existing table — verify structured error (not raw exception)
12. Call `mysql_drop_table` for already-dropped table with `ifExists: true` — verify success
13. Call `mysql_create_index` for existing index — verify structured error
14. Multiple sequential `mysql_analyze_table` calls — verify no degradation

## Category 4: Alias Combinations

15. Call `mysql_read_query` with `sql` alias — verify identical results to `query`
16. Call `mysql_describe_table` with `name` alias — verify identical to `table`
17. Call `mysql_describe_table` with `tableName` alias — verify identical to `table`

## Cleanup

18. Drop all `stress_*` tables

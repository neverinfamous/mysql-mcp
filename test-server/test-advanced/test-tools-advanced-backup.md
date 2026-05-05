# mysql-mcp Advanced Stress Tests: [backup]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

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
| `test_categories` | 17 | id, name, path, level | — |

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-backup.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Export Edge Cases

1. Create `stress_empty_export` table with 0 rows
2. `mysql_export_table({table: "stress_empty_export"})` → verify returns empty dataset (not crash)
3. `mysql_export_table({table: "test_products", limit: 0})` → verify behavior (empty or error)
4. `mysql_export_table({table: "nonexistent_xyz"})` → verify structured `{success: false}`

## Category 2: Format Boundary Values

5. `mysql_export_table({table: "test_products", format: "CSV", limit: 3})` → verify case-insensitive format acceptance
6. `mysql_export_table({table: "test_products", format: "csv", limit: 3})` → verify lowercase works
7. `mysql_export_table({table: "test_products", format: "json", limit: 3})` → verify JSON format
8. `mysql_export_table({table: "test_products", format: "invalid_format_xyz"})` → verify structured error

## Category 3: Dump Parameter Validation

9. `mysql_create_dump({database: "nonexistent_db_xyz"})` → verify structured `{success: false}`
10. `mysql_create_dump({database: "testdb", tables: []})` → verify behavior with empty tables array
11. `mysql_create_dump({database: "testdb", tables: ["nonexistent_table_xyz"]})` → verify structured error

## Category 4: Payload Monitoring

12. `mysql_export_table({table: "test_products"})` with no limit → log token estimate
13. Flag any response > 500 tokens as 📦

## Cleanup

14. Drop all `stress_*` tables

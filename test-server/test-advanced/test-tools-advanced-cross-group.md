# mysql-mcp Advanced Stress Tests: [cross-group]

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

- All basic deterministic checklists in `../test-tool-groups-codemode/` MUST pass first.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Code Mode Parity

1. Verify `mysql.help()` lists all registered groups
2. For each group, call `mysql.{group}.help()` and count methods
3. Verify total method count ≥ 192 (matching Tool-Reference.md)

## Category 2: Multi-Group Integration Workflows

### Workflow A: ETL Pipeline

4. Create `stress_etl_source` table with JSON column
5. Insert 5 rows with JSON data
6. Use `mysql.json.extract()` to extract values
7. Use `mysql.stats.descriptive()` on extracted numeric values
8. Verify end-to-end pipeline produces consistent results

### Workflow B: Schema → Performance Audit

9. `mysql.schema.listSchemas()` → get list
10. `mysql.core.listTables({database: "testdb"})` → get tables
11. For first 3 tables: `mysql.performance.tableStats({table})` → verify stats
12. `mysql.admin.analyzeTable({table: "test_products"})` → verify post-analyze

### Workflow C: Search → Stats → Export

13. `mysql.fulltext.search({table: "test_articles", columns: ["title", "body"], query: "MySQL"})` → results
14. `mysql.stats.descriptive({table: "test_articles", column: "id"})` → stats on matched IDs
15. `mysql.backup.exportTable({table: "test_articles", limit: 3})` → export subset

## Category 3: Error Consistency Cross-Group

16. For 5 different groups, call with `{table: "nonexistent_xyz"}` and verify all return consistent `{success: false, error: "..."}` format
17. For 5 different groups, call with `{}` empty params and verify all return Zod validation errors in the same format

## Cleanup

18. Drop all `stress_*` tables

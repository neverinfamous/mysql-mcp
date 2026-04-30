# mysql-mcp Advanced Stress Tests: [admin]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-admin.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Error Message Quality

1. For each tool group, pass intentionally invalid parameters and capture the error message
2. Verify error messages are human-readable (not raw MySQL error codes)
3. Verify error messages include the relevant entity name (table, column, etc.)

## Category 2: Type Mismatches

4. Pass string where number expected for all tools with numeric params
5. Pass number where string expected (e.g., `table: 123`)
6. Pass array where string expected
7. All must return structured errors, NOT raw MCP `-32602`

## Category 3: Payload Monitoring

8. Call `mysql_innodb_status()` without summary — log token estimate
9. Call `mysql_innodb_status({summary: true})` — log token estimate, verify reduction
10. Call `mysql_show_status()` without filter — log token estimate
11. Call `mysql_show_variables()` without filter — log token estimate
12. Flag any response > 500 tokens as 📦

## Category 4: Health Check Workflow

13. Execute full health check: `serverHealth()` → `analyzeTable()` → `checkTable()` → `tableStats()`
14. Verify no error accumulation across sequential admin operations

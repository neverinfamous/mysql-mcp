# mysql-mcp Advanced Stress Tests: [sys]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-sys.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Payload Efficiency Audit

1. `mysql_sys_user_summary()` → log token estimate
2. `mysql_sys_io_summary()` → log token estimate
3. `mysql_sys_statement_summary()` → log token estimate
4. `mysql_sys_wait_summary()` → log token estimate
5. `mysql_sys_innodb_lock_waits()` → log token estimate
6. `mysql_sys_schema_stats()` → log token estimate
7. `mysql_sys_host_summary()` → log token estimate
8. `mysql_sys_memory_summary()` → log token estimate
9. Flag any response > 500 tokens as 📦

## Category 2: Empty State Handling

10. `mysql_sys_innodb_lock_waits()` → verify clean empty response when no locks exist (should be `{success: true}` with empty or zero-length data, not an error)
11. Verify response shape is consistent with other sys tools (same top-level keys)

## Category 3: Sequential Stability

12. Call all 8 sys tools in rapid sequence within a single Code Mode script → verify all return `{success: true}`
13. Repeat the full sequence a second time → verify identical success pattern (no resource leaks or connection exhaustion)

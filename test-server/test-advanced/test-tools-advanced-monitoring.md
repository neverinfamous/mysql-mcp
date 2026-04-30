# mysql-mcp Advanced Stress Tests: [monitoring]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-monitoring.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Payload Efficiency

1. `mysql_show_processlist()` → log token estimate
2. `mysql_show_status()` with no filter → log token estimate
3. `mysql_show_status({like: "Uptime"})` → log token estimate, verify drastic reduction vs. unfiltered
4. `mysql_show_variables()` with no filter → log token estimate
5. `mysql_show_variables({like: "max_connections"})` → log token estimate, verify reduction
6. Flag any unfiltered response > 500 tokens as 📦

## Category 2: Summary Mode Parity

7. `mysql_innodb_status()` full → log token estimate
8. `mysql_innodb_status({summary: true})` → log token estimate
9. Verify summary token estimate is ≥ 50% smaller than full output

## Category 3: Filter Edge Cases

10. `mysql_show_status({like: ""})` → verify behavior (empty filter)
11. `mysql_show_status({like: "%"})` → verify returns same as no filter
12. `mysql_show_variables({like: "nonexistent_var_xyz_12345"})` → verify empty result set (not error)
13. `mysql_show_status({like: "Com_%"})` → verify wildcard filter returns subset

## Category 4: Sequential Stability

14. Call `mysql_server_health()` 5 times in rapid succession → verify all return `{success: true}` with no error accumulation
15. Call `mysql_pool_stats()` between health checks → verify pool metrics remain stable

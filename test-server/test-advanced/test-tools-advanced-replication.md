# mysql-mcp Advanced Stress Tests: [replication]

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

## Infrastructure Prerequisite

> **Note:** In a single-server environment, most replication tools return status-only results. If replication IS configured, Category 2 validates happy-path behavior. Category 1 validates resilience regardless of environment.

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-replication.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Single-Server Resilience

1. `mysql_master_status()` → verify structured `{success: true}` with binlog position (works on single server)
2. `mysql_slave_status()` → verify graceful response when no replication is configured (not crash)
3. `mysql_gtid_status()` → verify structured response (may be empty GTID set)
4. `mysql_replication_lag()` → verify structured response indicating no replica or 0 lag
5. All responses must have consistent top-level shape (`success` field present)

## Category 2: Binlog Boundary Values

6. `mysql_binlog_events({limit: 0})` → verify behavior (empty result or error)
7. `mysql_binlog_events({limit: 1})` → verify returns at most 1 event
8. `mysql_binlog_events({limit: 100})` → log token estimate, verify reasonable payload
9. `mysql_binlog_events({logFile: "nonexistent_binlog.000999"})` → verify structured `{success: false}`
10. `mysql_binlog_events({logFile: ""})` → verify structured error for empty filename

## Category 3: Happy-Path Stress (When Replication IS Available)

11. `mysql_master_status()` → verify binlog file, position, and GTID fields
12. `mysql_slave_status()` → verify replica state, IO/SQL thread status
13. `mysql_replication_lag()` → verify lag value is numeric ≥ 0
14. `mysql_gtid_status()` → verify GTID set format

## Category 4: Payload Monitoring

15. `mysql_binlog_events()` default → log token estimate
16. `mysql_master_status()` → log token estimate
17. Flag any response > 500 tokens as 📦

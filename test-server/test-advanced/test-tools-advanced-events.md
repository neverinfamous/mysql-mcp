# mysql-mcp Advanced Stress Tests: [events]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

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
| `test_categories`   | 17   | id, name, parent_id (FK self-ref)                 | —                   |

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-events.md` MUST pass first.

## Post-Test: Drop all `stress_*` events. Fix findings, update changelog, commit without pushing.

---

## Category 1: Lifecycle Collisions

1. `mysql_event_create({name: "stress_evt_dup", schedule: "EVERY 1 DAY", body: "SELECT 1", status: "DISABLE"})` → success
2. `mysql_event_create` with same name again → verify structured `{success: false}` (duplicate)
3. `mysql_event_alter({name: "stress_evt_nonexist", status: "DISABLE"})` → verify structured `{success: false}`
4. `mysql_event_drop({name: "stress_evt_nonexist"})` → verify structured `{success: false}`

## Category 2: Schedule Boundary Values

5. `mysql_event_create({name: "stress_evt_onetime", schedule: "AT CURRENT_TIMESTAMP + INTERVAL 1 HOUR", body: "SELECT 1", status: "DISABLE"})` → verify accepts one-time schedule
6. `mysql_event_create({name: "stress_evt_complex", schedule: "EVERY 30 SECOND STARTS CURRENT_TIMESTAMP", body: "SELECT 1", status: "DISABLE"})` → verify complex schedule syntax
7. `mysql_event_status({name: "stress_evt_onetime"})` → verify status reflects one-time schedule type
8. `mysql_event_status({name: "stress_evt_complex"})` → verify status reflects recurring schedule

## Category 3: Event Body Validation

9. `mysql_event_create({name: "stress_evt_invalid_sql", schedule: "EVERY 1 DAY", body: "INVALID SQL GIBBERISH", status: "DISABLE"})` → verify structured error (malformed SQL body)
10. `mysql_event_alter({name: "stress_evt_dup", body: "BEGIN SELECT 1; SELECT 2; END"})` → verify compound statement handling

## Category 4: Scheduler State

11. `mysql_scheduler_status()` → log current scheduler state
12. `mysql_event_list()` → verify all `stress_*` events appear in listing

## Cleanup

13. Drop all `stress_*` events

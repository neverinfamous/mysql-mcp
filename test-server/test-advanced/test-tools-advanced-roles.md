# mysql-mcp Advanced Stress Tests: [roles]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-roles.md` MUST pass first.

## Post-Test: Drop all `stress_*` roles. Fix findings, update changelog, commit without pushing.

---

## Category 1: Role Lifecycle Collisions

1. `mysql_role_create({name: "stress_role_a"})` → success
2. `mysql_role_create({name: "stress_role_a"})` again → verify structured `{success: false}` (duplicate)
3. `mysql_role_drop({name: "stress_role_nonexist"})` → verify structured `{success: false}` (not found)

## Category 2: Privilege Grant/Revoke Sequences

4. `mysql_role_grant({role: "stress_role_a", privilege: "SELECT", on: "testdb.*"})` → success
5. `mysql_role_grants({role: "stress_role_a"})` → verify SELECT is listed
6. `mysql_role_grant({role: "stress_role_a", privilege: "INSERT", on: "testdb.*"})` → success
7. `mysql_role_grants({role: "stress_role_a"})` → verify both SELECT and INSERT are listed
8. `mysql_role_revoke({role: "stress_role_a", privilege: "SELECT", on: "testdb.*"})` → success
9. `mysql_role_grants({role: "stress_role_a"})` → verify SELECT is removed, INSERT remains

## Category 3: Cascading Assign/Revoke Verification

10. `mysql_role_grant({role: "stress_role_a", privilege: "SELECT", on: "testdb.*"})` → re-grant
11. Verify `mysql_role_grants` reflects the re-granted privilege
12. `mysql_role_drop({name: "stress_role_a"})` → drop role entirely

## Category 4: Parameter Alias Parity

13. `mysql_role_grants` with `name` param → verify identical response to `role` param
14. `mysql_role_grant` with `privilege` and `on` aliases → verify structured success

## Category 5: Error Quality

15. `mysql_role_grant({role: "stress_role_nonexist", privilege: "SELECT", on: "testdb.*"})` → verify structured `{success: false}` (role not found)
16. `mysql_role_revoke({role: "stress_role_nonexist", privilege: "SELECT", on: "testdb.*"})` → verify structured `{success: false}`

## Cleanup

17. Drop all `stress_*` roles

# mysql-mcp Advanced Stress Tests: [migration]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-migration.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Checksum & State Corruption Resilience

1. Run `mysql_migration_init()` to prepare tracking tables.
2. Record a migration `001_base` with `checksum: "ABC"`.
3. Attempt to `mysql_migration_apply` a migration named `001_base` but with a conflicting query (which would produce a different checksum). Verify it fails with `{success: false, error: "..."}` citing checksum mismatch.
4. Manually update the `_mcp_schema_versions` tracking table to set the status of `001_base` to a corrupted string (e.g., `PENDING_BROKEN`). Run `mysql_migration_status` and verify it degrades gracefully (reporting an unknown state rather than crashing).

## Category 2: Rollback Boundaries & Idempotency

5. Run `mysql_migration_init()` again. Verify it is idempotent and does not wipe existing tracking data.
6. Apply a valid migration `002_new_col` that adds a column (ensure you provide `rollbackSql`).
7. Run `mysql_migration_rollback` for `002_new_col`. Verify success.
8. Attempt to run `mysql_migration_rollback` for `002_new_col` _again_. Verify it returns a structured `{success: false, error: "..."}` stating the migration is already rolled back.
9. Attempt to run `mysql_migration_rollback` for a version that was never applied (`003_ghost`). Verify structured failure.

## Category 3: Out-of-Order Execution Tracking

10. Apply migration `005_feature_z`.
11. Apply migration `003_feature_x`.
12. Run `mysql_migration_history`. Verify that the history correctly sorts/displays the applied order vs logical version order, and flags `003_feature_x` as an out-of-order application.
13. Run `mysql_migration_status`. Verify it correctly aggregates the total applied count despite the out-of-order execution.

## Category 4: Cleanup Verification

14. Drop all test columns generated and explicitly `DROP TABLE _mcp_schema_versions`. Verify clean removal.

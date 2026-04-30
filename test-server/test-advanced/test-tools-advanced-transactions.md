# mysql-mcp Advanced Stress Tests: [transactions]

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

- Basic deterministic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-transactions.md` MUST pass first.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Rollback Recovery

1. Begin transaction, INSERT row, ROLLBACK — verify row does not exist
2. Begin transaction, INSERT row, SAVEPOINT, INSERT another, ROLLBACK TO SAVEPOINT — verify only first row exists after COMMIT
3. Begin transaction, COMMIT empty transaction — verify no error

## Category 2: Abandoned Transactions

4. Begin transaction — do NOT commit or rollback. Begin a new transaction — verify the first is auto-cleaned or returns structured error.
5. Begin transaction with explicit isolation level (READ COMMITTED) — verify it takes effect

## Category 3: Rapid State Transitions

6. Execute 5 sequential begin/commit cycles — verify no connection pool exhaustion
7. Execute transaction_execute with 10+ statements — verify all succeed

## Category 4: Mixed Statement Failures

8. Execute transaction_execute with mix of valid and invalid SQL — verify rollback occurs on failure
9. Execute transaction_execute with empty `statements: []` — verify structured error
10. Execute transaction_execute with duplicate insert (PK violation) in middle of batch — verify auto-rollback and structured error

## Cleanup

11. Verify no lingering transactions or temp tables

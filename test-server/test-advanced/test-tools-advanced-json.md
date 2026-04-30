# mysql-mcp Advanced Stress Tests: [json]

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

- Basic deterministic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-json.md` MUST pass first.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Deep Mutation Workflows

1. Create `stress_json` table with JSON column, insert row with deeply nested object (3+ levels)
2. Extract from deep path `$.level1.level2.level3` — verify correct value
3. Set value at deep path — verify mutation took effect
4. Remove from deep path — verify removal
5. Insert at existing path (should not overwrite) — verify original value preserved

## Category 2: Array Operations

6. Insert row with JSON array, use json_array_append to add element
7. Verify array length increased
8. Remove element from array by index — verify removal

## Category 3: Edge Cases

9. Extract from NULL JSON column — verify structured response (not crash)
10. Validate empty string `""` — verify `{valid: false}`
11. Validate empty object `{}` — verify `{valid: true}`
12. Validate empty array `[]` — verify `{valid: true}`
13. json_diff with identical documents — verify no differences
14. json_merge with conflicting keys — verify last-writer-wins for PATCH

## Category 4: Payload Monitoring

15. json_stats on large JSON documents — monitor token estimate
16. json_keys on deeply nested documents — verify key listing

## Cleanup

17. Drop `stress_json` table

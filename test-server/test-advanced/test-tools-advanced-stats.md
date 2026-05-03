# mysql-mcp Advanced Stress Tests: [stats]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-stats.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Null & String Handling Boundaries

1. Create a table `stress_stats` with columns `id INT`, `val1 INT`, `val2 VARCHAR(50)`, `val3 INT`.
2. Insert 10 rows: 5 rows with `val1 = NULL`, 5 rows with valid ints. Set `val2` to random text.
3. Run `mysql_stats_correlation` on `val1` and `val3`. Verify it gracefully skips NULL rows and computes a valid correlation coefficient (or returns 0/null appropriately, rather than crashing).
4. Run window functions (`mysql_stats_row_number`, `mysql_stats_moving_avg`) on `val1` ordered by `id`. Verify NULLs are sorted consistently and don't break moving averages.
5. Attempt to run `mysql_stats_percentiles` on `val2` (VARCHAR). Verify it returns a structured `{success: false, error: "..."}` explicitly stating the column type mismatch.

## Category 2: Distribution & Histogram Edge Cases

6. Run `mysql_stats_histogram` on `val3` with `buckets: 0`. Verify it returns a structured validation error.
7. Run `mysql_stats_distribution` on `val3` with `buckets: 1000`. Verify performance boundaries; if payload is enormous, flag as 📦 Payload Issue.
8. Run `mysql_stats_frequency` on a column where every row is identical. Verify single-bucket output without division-by-zero crashes.

## Category 3: Hypothesis Testing Edge Cases

9. Create `stress_arrays` table with columns `group_a INT`, `group_b INT`.
10. Run `mysql_stats_hypothesis` (t-test) where `group_a` has 0 rows and `group_b` has 10 rows. Verify structured `{success: false, error: "..."}` regarding insufficient sample size.
11. Run `mysql_stats_hypothesis` where all values in `group_a` and `group_b` are exactly 0. Verify test logic handles zero variance gracefully.
12. Run `mysql_stats_outliers` on a column with only 2 rows. Verify gracefully handling minimum threshold limits.

## Category 4: Cleanup Verification

13. Drop tables `stress_stats` and `stress_arrays`. Verify clean removal.

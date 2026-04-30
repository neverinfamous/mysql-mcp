# mysql-mcp Advanced Stress Tests: [performance]

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

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-performance.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Explain Payload Sizes

1. `mysql_explain` with simple query — log token estimate
2. `mysql_explain` with complex JOIN query — log token estimate
3. `mysql_explain` with JSON format — log token estimate, compare to TRADITIONAL
4. `mysql_explain` with TREE format — log token estimate
5. Flag any EXPLAIN response > 300 tokens as 📦

## Category 2: Summary Mode Comparisons

6. `mysql_optimizer_trace` full vs `summary: true` — verify token reduction
7. `mysql_innodb_status` full vs `summary: true` — verify token reduction
8. `mysql_cluster_status` full vs `summary: true` — verify token reduction (if available)

## Category 3: Stats Boundary Testing

9. `mysql_query_stats` with `limit: 0` — verify behavior
10. `mysql_query_stats` with `limit: 1000` — verify reasonable truncation
11. `mysql_slow_queries` with `limit: 0` — verify behavior
12. `mysql_index_usage` on table with no indexes — verify response

## Category 4: Default Payload Audit

13. Call each performance tool with NO params (defaults) and log token estimates:
    - `queryStats()`, `slowQueries()`, `indexUsage()`, `bufferPoolStats()`, `threadStats()`
14. Flag any default response > 500 tokens as 📦

## Category 5: Anomaly Detection Boundaries

15. `mysql_detect_query_anomalies` with `minExecutions: 0` — verify behavior.
16. `mysql_detect_query_anomalies` with `stdDevThreshold: 9999` — verify no anomalies match but the tool succeeds.
17. Create an empty table `stress_empty`. Run `mysql_detect_bloat_risk` on it. Verify it handles 0 rows without division-by-zero crashes.
18. Run `mysql_detect_connection_spike` with `windowMinutes: -1`. Verify structured `{success: false, error: "..."}` for invalid window bounds.
19. Run `mysql_detect_connection_spike` with `thresholdPercent: 0`. Verify output logic correctly flags everything as a spike without crashing.

## Category 6: Cleanup

20. Drop `stress_empty` table. Verify clean removal.

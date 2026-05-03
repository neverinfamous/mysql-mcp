# mysql-mcp Code Mode Re-Testing: [stats]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

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
| `test_categories`   | 17   | id, name, path, level                 | —                   |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Report all failures, unexpected behaviors, or unnecessarily large payloads
5. **Scripting Efficiency**: Bundle multiple tool checks into a single `mysql_execute_code` call. Use conditional checks to aggregate errors and return a `failures` array.
6. **Pacing**: Test up to an entire tool group in a single script if feasible, but limit scripts to ~10-15 steps to remain manageable.

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

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- Your script should drop all `temp_*` objects at the end.

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables removed.
2. **Fix EVERY finding** — ❌ Fails, ⚠️ Issues, 📦 Payload.
3. **Read `../code-map.md` before making changes.**
4. Update the changelog if changes were made, commit without pushing.
5. Briefly summarize results with total token count prominently displayed.

---

## Group Focus: stats

stats Tool Group (20 tools +1 code mode):

1. `mysql_stats_descriptive` 2. `mysql_stats_percentiles` 3. `mysql_stats_correlation`
2. `mysql_stats_distribution` 5. `mysql_stats_time_series` 6. `mysql_stats_regression`
3. `mysql_stats_sampling` 8. `mysql_stats_histogram` 9. `mysql_stats_row_number`
4. `mysql_stats_rank` 11. `mysql_stats_lag_lead` 12. `mysql_stats_running_total`
5. `mysql_stats_moving_avg` 14. `mysql_stats_ntile` 15. `mysql_stats_hypothesis`
6. `mysql_stats_outliers` 17. `mysql_stats_top_n` 18. `mysql_stats_distinct`
7. `mysql_stats_frequency` 20. `mysql_stats_summary`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.stats.help()` → verify method listing
2. `mysql.stats.descriptive({table: "test_measurements", column: "temperature"})` → `mean`, `stddev`, `min`, `max`
3. `mysql.stats.percentiles({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75]})` → 3 values
4. `mysql.stats.correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → between -1 and 1
5. `mysql.stats.distribution({table: "test_measurements", column: "temperature", buckets: 10})` → bucket entries
6. `mysql.stats.histogram({table: "test_measurements", column: "temperature", buckets: 10})` → histogram data
7. `mysql.stats.sampling({table: "test_measurements", sampleSize: 10})` → ~10 rows
8. `mysql.stats.regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity"})` → coefficients
9. `mysql.stats.rowNumber({table: "test_measurements", orderBy: "temperature"})` → row numbers
10. `mysql.stats.movingAvg({table: "test_measurements", column: "temperature", windowSize: 3, orderBy: "id"})` → moving average
11. `mysql.stats.outliers({table: "test_measurements", column: "temperature", method: "zscore"})` → outlier detection
12. `mysql.stats.summary({table: "test_measurements", columns: ["temperature", "humidity"]})` → multivariable summary

**Domain error paths (🔴):**

13. 🔴 `mysql.stats.descriptive({table: "nonexistent_xyz", column: "x"})` → `{success: false}`
14. 🔴 `mysql.stats.correlation({table: "test_measurements", column1: "nonexistent_col", column2: "humidity"})` → `{success: false}`
15. 🔴 `mysql.stats.movingAvg({table: "test_measurements", column: "nonexistent_col", windowSize: 3, orderBy: "id"})` → `{success: false}`

**Zod validation error paths (🔴):**

16. 🔴 `mysql.stats.descriptive({})` → `{success: false, error: "Validation error: ..."}`
17. 🔴 `mysql.stats.percentiles({})` → `{success: false, error: "Validation error: ..."}`
18. 🔴 `mysql.stats.outliers({})` → `{success: false, error: "Validation error: ..."}`

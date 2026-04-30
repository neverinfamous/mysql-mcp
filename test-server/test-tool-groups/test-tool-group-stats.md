# mysql-mcp Tool Group Testing: [stats]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|-------|------|-------------|--------------|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_json_docs` | 8 | id, doc, metadata, tags | doc, metadata, tags |
| `test_articles` | 10 | id, title, body, author (FULLTEXT) | — |
| `test_users` | 10 | id, username, email, phone, bio, role | — |
| `test_measurements` | 200 | id, sensor_id (INT 1-5), temperature, humidity | — |
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT) | — |
| `test_categories` | 17 | id, name, path, level | — |
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, \_id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
6. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: stats

### stats Group-Specific Testing

stats Tool Group (20 tools +1 for code mode):

1. 'mysql_stats_descriptive'
2. 'mysql_stats_percentiles'
3. 'mysql_stats_correlation'
4. 'mysql_stats_distribution'
5. 'mysql_stats_time_series'
6. 'mysql_stats_regression'
7. 'mysql_stats_sampling'
8. 'mysql_stats_histogram'
9. 'mysql_stats_row_number'
10. 'mysql_stats_rank'
11. 'mysql_stats_lag_lead'
12. 'mysql_stats_running_total'
13. 'mysql_stats_moving_avg'
14. 'mysql_stats_ntile'
15. 'mysql_stats_hypothesis'
16. 'mysql_stats_outliers'
17. 'mysql_stats_top_n'
18. 'mysql_stats_distinct'
19. 'mysql_stats_frequency'
20. 'mysql_stats_summary'
21. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

**Test data:** Uses `test_measurements` (200 rows, sensor_id 1-5, columns: temperature, humidity).

**Checklist:**

1. `mysql_stats_descriptive({table: "test_measurements", column: "temperature"})` → verify `mean`, `stddev`, `min`, `max` present
2. `mysql_stats_percentiles({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75]})` → verify 3 percentile values
3. `mysql_stats_correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → verify correlation value between -1 and 1
4. `mysql_stats_distribution({table: "test_measurements", column: "temperature", buckets: 10})` → verify `buckets` array with entries
5. `mysql_stats_histogram({table: "test_measurements", column: "temperature", buckets: 10})` → verify histogram data
6. `mysql_stats_sampling({table: "test_measurements", sampleSize: 10})` → verify approximately 10 rows returned
7. `mysql_stats_regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity"})` → verify regression coefficients returned
8. `mysql_stats_row_number({table: "test_measurements", orderBy: "temperature"})` → verify row numbers
9. `mysql_stats_moving_avg({table: "test_measurements", column: "temperature", windowSize: 3, orderBy: "id"})` → verify moving average
10. `mysql_stats_outliers({table: "test_measurements", column: "temperature", method: "zscore"})` → verify outlier detection
11. `mysql_stats_summary({table: "test_measurements", columns: ["temperature", "humidity"]})` → verify multivariable summary

**Domain error paths (🔴):**

12. 🔴 `mysql_stats_descriptive({table: "nonexistent_xyz", column: "x"})` → `{success: false, error: "..."}` handler error
13. 🔴 `mysql_stats_correlation({table: "test_products", column1: "name", column2: "description"})` → error about non-numeric columns
14. 🔴 `mysql_stats_moving_avg({table: "test_measurements", column: "nonexistent_col", windowSize: 3, orderBy: "id"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

15. 🔴 `mysql_stats_descriptive({})` → `{success: false, error: "..."}` (Zod validation)
16. 🔴 `mysql_stats_percentiles({})` → `{success: false, error: "..."}` (missing required params)
17. 🔴 `mysql_stats_outliers({})` → `{success: false, error: "..."}` (Zod validation)

**Wrong-type numeric param coercion (🔴):**

18. 🔴 `mysql_stats_sampling({table: "test_measurements", sampleSize: "abc"})` → must NOT return raw MCP error
19. 🔴 `mysql_stats_distribution({table: "test_measurements", column: "temperature", buckets: "abc"})` → must NOT return raw MCP error
20. 🔴 `mysql_stats_histogram({table: "test_measurements", column: "temperature", buckets: "abc"})` → must NOT return raw MCP error

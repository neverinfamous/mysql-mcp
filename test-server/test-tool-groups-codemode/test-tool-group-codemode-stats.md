# mysql-mcp Code Mode Re-Testing: [stats]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Test Data: `test_measurements` (200 rows, sensor_id 1-5, temperature, humidity)

## Requirements

1. **Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.
3. Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: stats

stats Tool Group (8 tools +1 code mode):

1. `mysql_stats_descriptive` 2. `mysql_stats_percentiles` 3. `mysql_stats_correlation`
4. `mysql_stats_distribution` 5. `mysql_stats_time_series` 6. `mysql_stats_regression`
7. `mysql_stats_sampling` 8. `mysql_stats_histogram`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.stats.help()` → verify method listing
2. `mysql.stats.descriptive({table: "test_measurements", column: "temperature"})` → `mean`, `stddev`, `min`, `max`
3. `mysql.stats.percentiles({table: "test_measurements", column: "temperature", percentiles: [25, 50, 75]})` → 3 values
4. `mysql.stats.correlation({table: "test_measurements", column1: "temperature", column2: "humidity"})` → between -1 and 1
5. `mysql.stats.distribution({table: "test_measurements", column: "temperature", buckets: 10})` → bucket entries
6. `mysql.stats.histogram({table: "test_measurements", column: "temperature", buckets: 10})` → histogram data
7. `mysql.stats.sampling({table: "test_measurements", sampleSize: 10})` → ~10 rows
8. `mysql.stats.regression({table: "test_measurements", xColumn: "temperature", yColumn: "humidity"})` → coefficients

**Domain error paths (🔴):**

9. 🔴 `mysql.stats.descriptive({table: "nonexistent_xyz", column: "x"})` → `{success: false}`
10. 🔴 `mysql.stats.correlation({table: "test_measurements", column1: "nonexistent_col", column2: "humidity"})` → `{success: false}`

**Zod validation error paths (🔴):**

11. 🔴 `mysql.stats.descriptive({})` → `{success: false, error: "Validation error: ..."}`
12. 🔴 `mysql.stats.percentiles({})` → `{success: false, error: "Validation error: ..."}`

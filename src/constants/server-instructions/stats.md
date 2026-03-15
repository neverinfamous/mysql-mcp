# Stats Tools (`mysql_stats_*`)

- **Descriptive statistics**: `mysql_stats_descriptive` returns mean, median, stddev, min, max, count for numeric columns. Supports `where` filtering.
- **Percentiles**: `mysql_stats_percentiles` calculates custom percentile values (default: p25, p50, p75, p90, p95, p99).
- **Correlation**: `mysql_stats_correlation` calculates Pearson correlation between two numeric columns with interpretation.
- **Distribution**: `mysql_stats_distribution` analyzes value distribution with configurable histogram buckets.
- **Time series**: `mysql_stats_time_series` aggregates data by time intervals (minute/hour/day/week/month) with sum/avg/count/min/max.
- **Regression**: `mysql_stats_regression` performs simple linear regression (y = mx + b) with R² fit analysis.
- **Sampling**: `mysql_stats_sampling` returns random rows. Use `seed` for reproducibility, `columns` to limit output.
- **Histogram**: `mysql_stats_histogram` views MySQL 8.0+ optimizer histogram statistics. Use `update: true` to create/refresh. Returns `{ exists: false, table }` when the table does not exist, and `{ exists: false, column, table, message }` when the column does not exist on the table.
- **Error handling**: All stats tools return `{ exists: false, table }` gracefully when the table does not exist, and `{ success: false, error }` for other query errors (e.g., unknown column). No raw MySQL errors are thrown.

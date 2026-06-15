# Stats Tools (`mysql_stats_*`)

- **Descriptive**: `mysql_stats_descriptive` (mean, median, stddev, min, max, count), `mysql_stats_percentiles` (custom percentiles), `mysql_stats_distribution` (histogram buckets), `mysql_stats_time_series` (aggregates by time interval), `mysql_stats_sampling` (random rows).
- **Comparative**: `mysql_stats_correlation` (Pearson correlation), `mysql_stats_regression` (simple linear regression), `mysql_stats_histogram` (MySQL 8.0+ optimizer histograms, use `update: true` to refresh).
- **Advanced**: `mysql_stats_hypothesis` (one-sample t-tests or z-tests), `mysql_stats_outliers` (z-score/iqr outlier detection), `mysql_stats_top_n` (top N rows excluding long content), `mysql_stats_distinct` (distinct counts and values), `mysql_stats_frequency` (value frequency distribution), `mysql_stats_summary` (summary of multiple numeric columns).
- **Window**: `mysql_stats_row_number`, `mysql_stats_rank`, `mysql_stats_lag_lead`, `mysql_stats_running_total`, `mysql_stats_moving_avg`, `mysql_stats_ntile`.
- **Error handling**: All stats tools return `{ success: false, error: "...", code: "..." }` when a table or column does not exist, or for Zod validation errors. No raw MySQL errors are thrown.

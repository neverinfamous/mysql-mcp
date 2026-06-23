# mysql-mcp Advanced Stress Testing: [stats-time-series]

> [!IMPORTANT]
> **Do not track progress in this file.** Track your test progress, coverage matrix, and findings in your internal task tracking system (artifact). However, you SHOULD edit this file to fix any factual errors, broken code, or incorrect assertions in the test prompts.
> If there are no changes/fixes, do not update UNRELEASED.md or create a memory-journal-mcp entry.

## Setup & Pre-requisites

**Step 1:** Execute ALL tests below using ONLY code mode (`mysql_execute_code`). These are second-pass stress tests — basic checklists must pass first. Do not skip tests. Return an aggregated `failures` array.

## Category 1: Time Series Edge Cases

1. Create a table `stress_stats_time_series` with columns `id INT`, `val_col INT`, `time_col DATETIME`.
2. Insert 10 rows: some with NULL values in `val_col`, and spread across different days/hours.
3. Run `mysql_stats_time_series` with valid parameters (`interval: 'day'`, `aggregation: 'avg'`). Verify it aggregates properly and doesn't crash on NULLs.
4. Test with invalid interval: Run `mysql_stats_time_series` with `interval: 'decade'`. It must return `{success: false, error: ...}` and NOT a raw MCP error.
5. Test with missing required parameters: Run `mysql_stats_time_series` with `{ table: 'stress_stats_time_series' }` (omitting `valueColumn` and `timeColumn`). It must return `{success: false, error: ...}` instead of a raw MCP `-32602` error.
6. Test with empty object: Run `mysql_stats_time_series` with `{}`. Should return `{success: false, error: ...}`.

## Category 2: Type Validation & Cleanup

7. Test coercion: Run `mysql_stats_time_series` with `limit: "abc"`. Should return `{success: false, error: ...}` due to validation intercept.
8. Drop table `stress_stats_time_series`.

# mysql-mcp Advanced Stress Tests: [stats]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-stats.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Null & String Handling Boundaries

21. ✅ Create a table `stress_stats` with columns `id INT`, `val1 INT`, `val2 VARCHAR(50)`, `val3 INT`.
22. ✅ Insert 10 rows: 5 rows with `val1 = NULL`, 5 rows with valid ints. Set `val2` to random text.
23. ✅ Run `mysql_stats_correlation` on `val1` and `val3`. Verify it gracefully skips NULL rows and computes a valid correlation coefficient (or returns 0/null appropriately, rather than crashing).
24. ✅ Run window functions (`mysql_stats_row_number`, `mysql_stats_moving_avg`) on `val1` ordered by `id`. Verify NULLs are sorted consistently and don't break moving averages.
25. ✅ Attempt to run `mysql_stats_percentiles` on `val2` (VARCHAR). Verify it returns a structured `{success: false, error: "..."}` explicitly stating the column type mismatch.

## Category 2: Distribution & Histogram Edge Cases

29. ✅ Run `mysql_stats_histogram` on `val3` with `buckets: 0`. Verify it returns a structured validation error.
30. 📦 Run `mysql_stats_distribution` on `val3` with `buckets: 1000`. Verify performance boundaries; (Issue avoided by Zod schema limit of max 500. Limit bumped to 1000 in code but requires MCP server restart. Kept as 📦 for tracking payload size monitoring).
31. ✅ Run `mysql_stats_frequency` on a column where every row is identical. Verify single-bucket output without division-by-zero crashes.

## Category 3: Hypothesis Testing Edge Cases

35. ✅ Create `stress_arrays` table with columns `group_a INT`, `group_b INT`.
36. ✅ Run `mysql_stats_hypothesis` (t-test) where `group_a` has 0 rows and `group_b` has 10 rows. Verify structured `{success: false, error: "..."}` regarding insufficient sample size.
37. ✅ Run `mysql_stats_hypothesis` where all values in `group_a` and `group_b` are exactly 0. Verify test logic handles zero variance gracefully.
38. ✅ Run `mysql_stats_outliers` on a column with only 2 rows. Verify gracefully handling minimum threshold limits.

## Category 4: Cleanup Verification

42. ✅ Drop tables `stress_stats` and `stress_arrays`. Verify clean removal.

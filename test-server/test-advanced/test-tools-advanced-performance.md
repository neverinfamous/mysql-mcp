# mysql-mcp Advanced Stress Tests: [performance]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups/test-tool-group-performance.md` MUST pass first.

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

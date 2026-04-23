# mysql-mcp Advanced Stress Tests: [core]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic deterministic checklists in `../test-tool-groups/test-tool-group-core.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Boundary Values

1. Insert MAX INT, MIN INT, 0, NULL into a `stress_boundary` table
2. Test VARCHAR with empty string `''`, max length string, and NULL
3. Test DECIMAL with very large/small values
4. Test DATE with `0000-00-00`, `9999-12-31`
5. Query empty table (0 rows) — verify response shape is consistent

## Category 2: State Pollution

6. Create `stress_pollution` table, insert rows, verify count
7. Drop and recreate same table — verify no row leakage
8. Create table with same name as a dropped table — verify clean slate
9. Insert duplicate primary key — verify structured error
10. Insert NULL into NOT NULL column — verify structured error

## Category 3: Idempotency

11. Call `mysql_create_table` for existing table — verify structured error (not raw exception)
12. Call `mysql_drop_table` for already-dropped table with `ifExists: true` — verify success
13. Call `mysql_create_index` for existing index — verify structured error
14. Multiple sequential `mysql_analyze_table` calls — verify no degradation

## Category 4: Alias Combinations

15. Call `mysql_read_query` with `sql` alias — verify identical results to `query`
16. Call `mysql_describe_table` with `name` alias — verify identical to `table`
17. Call `mysql_describe_table` with `tableName` alias — verify identical to `table`

## Cleanup

18. Drop all `stress_*` tables

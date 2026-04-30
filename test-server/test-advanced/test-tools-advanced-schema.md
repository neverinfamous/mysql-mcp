# mysql-mcp Advanced Stress Tests: [schema]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-schema.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` schemas, views, and objects. Fix findings, update changelog, commit without pushing.

---

## Category 1: DDL Idempotency

1. `mysql_create_schema({name: "stress_schema_dup"})` → success
2. `mysql_create_schema({name: "stress_schema_dup"})` again → verify structured `{success: false}` (duplicate)
3. `mysql_drop_schema({name: "stress_schema_dup"})` → success
4. `mysql_drop_schema({name: "stress_schema_dup"})` again → verify structured `{success: false}` (already dropped)
5. Create view `stress_view_dup` on `test_products`, then create again with same name → verify structured error
6. Drop the view, recreate it → verify clean slate (no leftover state)

## Category 2: Cross-Object Dependencies

7. Create view `stress_dep_view` joining `test_orders` and `test_products` on FK → verify success
8. `mysql_list_constraints({table: "test_orders"})` → verify FK to `test_products` is visible
9. Create a view referencing a subquery with aggregation → verify `createView` handles complex SQL
10. Drop the dependent view → verify clean removal

## Category 3: Parameter Alias Stress

11. `mysql_list_constraints` with `database` param → verify identical to `schema` param
12. `mysql_create_view` with `query` param → verify identical to `definition` param
13. `mysql_list_views` with `database` param → verify response matches `schema` param

## Category 4: Payload Monitoring

14. `mysql_list_constraints({table: "test_orders"})` → log token estimate
15. `mysql_list_triggers({database: "testdb"})` → log token estimate
16. `mysql_list_stored_procedures({database: "testdb"})` → log token estimate
17. Flag any response > 500 tokens as 📦

## Cleanup

18. Drop all `stress_*` schemas and views

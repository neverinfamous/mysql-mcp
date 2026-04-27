# mysql-mcp Advanced Stress Tests: [backup]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-backup.md` MUST pass first.
- Database must be freshly seeded.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Export Edge Cases

1. Create `stress_empty_export` table with 0 rows
2. `mysql_export_table({table: "stress_empty_export"})` → verify returns empty dataset (not crash)
3. `mysql_export_table({table: "test_products", limit: 0})` → verify behavior (empty or error)
4. `mysql_export_table({table: "nonexistent_xyz"})` → verify structured `{success: false}`

## Category 2: Format Boundary Values

5. `mysql_export_table({table: "test_products", format: "CSV", limit: 3})` → verify case-insensitive format acceptance
6. `mysql_export_table({table: "test_products", format: "csv", limit: 3})` → verify lowercase works
7. `mysql_export_table({table: "test_products", format: "json", limit: 3})` → verify JSON format
8. `mysql_export_table({table: "test_products", format: "invalid_format_xyz"})` → verify structured error

## Category 3: Dump Parameter Validation

9. `mysql_create_dump({database: "nonexistent_db_xyz"})` → verify structured `{success: false}`
10. `mysql_create_dump({database: "testdb", tables: []})` → verify behavior with empty tables array
11. `mysql_create_dump({database: "testdb", tables: ["nonexistent_table_xyz"]})` → verify structured error

## Category 4: Payload Monitoring

12. `mysql_export_table({table: "test_products"})` with no limit → log token estimate
13. Flag any response > 500 tokens as 📦

## Cleanup

14. Drop all `stress_*` tables

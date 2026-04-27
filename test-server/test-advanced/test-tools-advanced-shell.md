# mysql-mcp Advanced Stress Tests: [shell]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Infrastructure Prerequisite

> **Note:** Requires MySQL Shell 8.0+ installed. Configure `mysql-ecosystem` MCP server. If MySQL Shell is unavailable, Category 1 validates graceful degradation. If available, Categories 2–4 validate boundary values and parameter validation.

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-shell.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Graceful Degradation (No MySQL Shell)

1. `mysqlsh_version()` → verify structured `{success: false}` when mysqlsh is not installed (not raw child_process crash)
2. `mysqlsh_dump_instance({outputUrl: "/tmp/stress_dump"})` → verify structured error
3. `mysqlsh_load_dump({inputUrl: "/tmp/nonexistent_dump"})` → verify structured error
4. `mysqlsh_run_script({script: "print('test')"})` → verify structured error
5. All errors must use consistent `{success: false, error: "..."}` format

## Category 2: Dry Run Boundaries (When Shell IS Available)

6. `mysqlsh_dump_schemas({schemas: ["testdb"], outputUrl: "/tmp/stress_schema_dump", dryRun: true})` → verify dry run output
7. `mysqlsh_dump_tables({schema: "testdb", tables: ["test_products"], outputUrl: "/tmp/stress_table_dump", dryRun: true})` → verify dry run
8. `mysqlsh_dump_schemas({schemas: ["nonexistent_db_xyz"], outputUrl: "/tmp/stress_bad_dump", dryRun: true})` → verify structured error for nonexistent schema
9. `mysqlsh_dump_tables({schema: "testdb", tables: ["nonexistent_table_xyz"], outputUrl: "/tmp/stress_bad_table", dryRun: true})` → verify structured error

## Category 3: Parameter Validation

10. `mysqlsh_dump_schemas({schemas: [], outputUrl: "/tmp/test"})` → verify behavior with empty schemas array
11. `mysqlsh_dump_tables({schema: "testdb", tables: [], outputUrl: "/tmp/test"})` → verify behavior with empty tables array
12. `mysqlsh_export_table({schema: "testdb", table: "test_products", outputUrl: "/tmp/stress_export"})` → verify success
13. `mysqlsh_import_table({schema: "testdb", table: "nonexistent_xyz", inputUrl: "/tmp/nonexistent_file"})` → verify structured error

## Category 4: Script Execution Safety

14. `mysqlsh_run_script({script: "INVALID SYNTAX @@@@"})` → verify structured `{success: false}` (not raw crash)
15. `mysqlsh_run_script({script: "print('hello world')", language: "javascript"})` → verify success
16. `mysqlsh_run_script({script: ""})` → verify behavior with empty script

# mysql-mcp Code Mode Re-Testing: [shell]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Infrastructure Prerequisite

> **Note:** Requires MySQL Shell 8.0+ installed. Configure `mysql-ecosystem` MCP server.

## Requirements

1. **Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.
3. Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: shell

shell Tool Group (10 tools +1 code mode):

1. `mysqlsh_version` 2. `mysqlsh_check_upgrade` 3. `mysqlsh_export_table`
4. `mysqlsh_import_table` 5. `mysqlsh_import_json` 6. `mysqlsh_dump_instance`
7. `mysqlsh_dump_schemas` 8. `mysqlsh_dump_tables` 9. `mysqlsh_load_dump`
10. `mysqlsh_run_script`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.shell.help()` → verify method listing
2. `mysql.shell.version()` → MySQL Shell version
3. `mysql.shell.dumpSchemas({schemas: ["testdb"], outputUrl: "/tmp/cm_dump", dryRun: true})` → dump command
4. `mysql.shell.dumpSchemas({schemas: ["testdb"], outputUrl: "/tmp/cm_dump", ddlOnly: true, dryRun: true})` → DDL-only
5. `mysql.shell.dumpTables({schema: "testdb", tables: ["test_products"], outputUrl: "/tmp/cm_tables", dryRun: true})` → table dump

**Domain error paths (🔴):**

6. 🔴 `mysql.shell.dumpSchemas({schemas: ["nonexistent_xyz"], outputUrl: "/tmp/test"})` → `{success: false}`

**Zod validation error paths (🔴):**

7. 🔴 `mysql.shell.dumpSchemas({})` → `{success: false, error: "Validation error: ..."}`
8. 🔴 `mysql.shell.exportTable({})` → `{success: false, error: "Validation error: ..."}`
9. 🔴 `mysql.shell.runScript({})` → `{success: false, error: "Validation error: ..."}`

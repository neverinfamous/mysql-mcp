# mysql-mcp Code Mode Re-Testing: [shell]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

## Infrastructure Prerequisite

> **Note:** Requires MySQL Shell 8.0+ installed. Configure `mysql-ecosystem` MCP server.

---

## Group Focus: shell

shell Tool Group (10 tools +1 code mode):

1. `mysqlsh_version` 2. `mysqlsh_check_upgrade` 3. `mysqlsh_export_table`
2. `mysqlsh_import_table` 5. `mysqlsh_import_json` 6. `mysqlsh_dump_instance`
3. `mysqlsh_dump_schemas` 8. `mysqlsh_dump_tables` 9. `mysqlsh_load_dump`
4. `mysqlsh_run_script`

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

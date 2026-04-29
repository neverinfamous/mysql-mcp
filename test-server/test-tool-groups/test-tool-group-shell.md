# mysql-mcp Tool Group Testing: [shell]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Infrastructure Prerequisite

> **Note:** The Shell tools require MySQL Shell 8.0+ installed. Configure the `mysql-ecosystem` MCP server entry and ensure `mysqlsh` is accessible. In a non-Shell environment, these tools should return structured errors — NOT raw MCP exceptions.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: shell

### shell Group-Specific Testing

shell Tool Group (10 tools +1 for code mode):

1. 'mysqlsh_version'
2. 'mysqlsh_check_upgrade'
3. 'mysqlsh_export_table'
4. 'mysqlsh_import_table'
5. 'mysqlsh_import_json'
6. 'mysqlsh_dump_instance'
7. 'mysqlsh_dump_schemas'
8. 'mysqlsh_dump_tables'
9. 'mysqlsh_load_dump'
10. 'mysqlsh_run_script'
11. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. ✅ `mysqlsh_version()` → verify MySQL Shell version and installation status
2. ✅ `mysqlsh_dump_schemas({schemas: ["testdb"], outputUrl: "/tmp/test_dump", dryRun: true})` → verify dump command generated
3. ✅ `mysqlsh_dump_schemas({schemas: ["testdb"], outputUrl: "/tmp/test_dump", ddlOnly: true, dryRun: true})` → verify DDL-only mode
4. ✅ `mysqlsh_dump_tables({schema: "testdb", tables: ["test_products"], outputUrl: "/tmp/test_tables", dryRun: true})` → verify table dump command

**Domain error paths (🔴):**

5. ✅ 🔴 `mysqlsh_dump_schemas({schemas: ["nonexistent_db_xyz"], outputUrl: "/tmp/test"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

6. ✅ 🔴 `mysqlsh_dump_schemas({})` → `{success: false, error: "..."}` (Zod validation)
7. ✅ 🔴 `mysqlsh_export_table({})` → `{success: false, error: "..."}` (missing required params)
8. ✅ 🔴 `mysqlsh_run_script({})` → `{success: false, error: "..."}` (missing required params)

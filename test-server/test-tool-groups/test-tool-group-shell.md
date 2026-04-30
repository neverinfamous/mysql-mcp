# mysql-mcp Tool Group Testing: [shell]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Infrastructure Prerequisite

> **Note:** The Shell tools require MySQL Shell 8.0+ installed. Configure the `mysql-ecosystem` MCP server entry and ensure `mysqlsh` is accessible. In a non-Shell environment, these tools should return structured errors — NOT raw MCP exceptions.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|-------|------|-------------|--------------|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_json_docs` | 8 | id, doc, metadata, tags | doc, metadata, tags |
| `test_articles` | 10 | id, title, body, author (FULLTEXT) | — |
| `test_users` | 10 | id, username, email, phone, bio, role | — |
| `test_measurements` | 200 | id, sensor_id (INT 1-5), temperature, humidity | — |
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT) | — |
| `test_categories` | 17 | id, name, path, level | — |
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, \_id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |

## Testing Requirements

1. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}` — NOT raw MCP error.
2. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type                 | What you see                                     | Verdict |
| -------------------- | ------------------------------------------------ | ------- |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌     | Raw text error string with `isError: true`       | Bug     |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

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

1. `mysqlsh_version()` → verify MySQL Shell version and installation status
2. `mysqlsh_dump_schemas({schemas: ["testdb"], outputUrl: "/tmp/test_dump", dryRun: true})` → verify dump command generated
3. `mysqlsh_dump_schemas({schemas: ["testdb"], outputUrl: "/tmp/test_dump", ddlOnly: true, dryRun: true})` → verify DDL-only mode
4. `mysqlsh_dump_tables({schema: "testdb", tables: ["test_products"], outputUrl: "/tmp/test_tables", dryRun: true})` → verify table dump command

**Domain error paths (🔴):**

5. 🔴 `mysqlsh_dump_schemas({schemas: ["nonexistent_db_xyz"], outputUrl: "/tmp/test"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

6. 🔴 `mysqlsh_dump_schemas({})` → `{success: false, error: "..."}` (Zod validation)
7. 🔴 `mysqlsh_export_table({})` → `{success: false, error: "..."}` (missing required params)
8. 🔴 `mysqlsh_run_script({})` → `{success: false, error: "..."}` (missing required params)

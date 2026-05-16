# mysql-mcp Advanced Stress Tests: [shell]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity    | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                             | —                   |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type                 | What you see                                     | Verdict            |
| -------------------- | ------------------------------------------------ | ------------------ |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct            |
| **MCP error** ❌     | Raw error string, no `success` field             | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

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

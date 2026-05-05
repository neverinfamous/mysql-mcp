# mysql-mcp Code Mode Re-Testing: [schema]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

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
| `test_categories`   | 17   | id, name, path, level                 | —                   |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Report all failures, unexpected behaviors, or unnecessarily large payloads
5. **Scripting Efficiency**: Bundle multiple tool checks into a single `mysql_execute_code` call. Use conditional checks to aggregate errors and return a `failures` array.
6. **Pacing**: Test up to an entire tool group in a single script if feasible, but limit scripts to ~10-15 steps to remain manageable.

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

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- Your script should drop all `temp_*` objects at the end.

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables removed.
2. **Fix EVERY finding** — ❌ Fails, ⚠️ Issues, 📦 Payload.
3. **Read `../code-map.md` before making changes.**
4. Update the changelog if changes were made, commit without pushing.
5. Briefly summarize results with total token count prominently displayed.

---

## Group Focus: schema

schema Tool Group (11 tools +1 code mode):

1. `mysql_list_schemas` 2. `mysql_create_schema` 3. `mysql_drop_schema` 4. `mysql_list_views`
5. `mysql_create_view` 6. `mysql_drop_view` 7. `mysql_list_stored_procedures` 8. `mysql_list_functions`
9. `mysql_list_triggers` 10. `mysql_list_constraints` 11. `mysql_list_events`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.schema.help()` → verify method listing
2. `mysql.schema.listSchemas()` → verify `testdb` present
3. `mysql.schema.listViews({database: "testdb"})` → verify structure
4. `mysql.schema.listConstraints({table: "test_orders"})` → verify FK present
5. `mysql.schema.listTriggers({database: "testdb"})` → verify structure
6. `mysql.schema.listStoredProcedures({database: "testdb"})` → verify structure
7. `mysql.schema.listFunctions({database: "testdb"})` → verify structure
8. `mysql.schema.listEvents({database: "testdb"})` → verify structure

**Create → Drop lifecycle:**

9. `mysql.schema.createView({name: "temp_cm_view", query: "SELECT id, name FROM test_products"})` → `success: true`
10. `mysql.schema.listViews({database: "testdb"})` → verify `temp_cm_view` present
11. Drop via `mysql.schema.dropView({name: "temp_cm_view"})`

**Domain error paths (🔴):**

12. 🔴 `mysql.schema.listConstraints({table: "nonexistent_xyz"})` → `{success: false}` or empty
13. 🔴 `mysql.schema.dropSchema({name: "nonexistent_db_xyz"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

14. 🔴 `mysql.schema.createView({})` → `{success: false, error: "Validation error: ..."}`
15. 🔴 `mysql.schema.createSchema({})` → `{success: false, error: "Validation error: ..."}`

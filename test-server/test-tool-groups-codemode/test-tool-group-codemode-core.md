# mysql-mcp Code Mode Re-Testing: [core]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

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
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, \_id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Report all failures, unexpected behaviors, or unnecessarily large payloads
6. **Scripting Efficiency**: Bundle multiple tool checks into a single `mysql_execute_code` call. Use conditional checks to aggregate errors and return a `failures` array.
7. **Pacing**: Test up to an entire tool group in a single script if feasible, but limit scripts to ~10-15 steps to remain manageable.

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw error string, no `success` field | Bug — report as ❌ |

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

## Group Focus: core

### core Group-Specific Testing

core Tool Group (8 tools +1 code mode):

1. 'mysql_read_query'
2. 'mysql_write_query'
3. 'mysql_list_tables'
4. 'mysql_describe_table'
5. 'mysql_create_table'
6. 'mysql_drop_table'
7. 'mysql_create_index'
8. 'mysql_get_indexes'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Construct a single `mysql_execute_code` script to execute the numbered checklist items below. Use the `mysql.*` namespace to call the corresponding methods with the exact inputs shown. Compare responses against the expected results within your script, and push any deviations or errors to a `failures` array. Return the `failures` array at the end of the script. Report any issues logged.

1. `mysql.core.help()` → verify method listing includes `readQuery`, `writeQuery`, `listTables`, etc.
2. `mysql.core.readQuery({query: "SELECT COUNT(*) AS n FROM test_orders"})` → `n === 20`
3. `mysql.core.readQuery({query: "SELECT id, name FROM test_products WHERE price > 50 LIMIT 3"})` → 3 rows
4. `mysql.core.listTables({database: "testdb", limit: 5})` → 5 tables returned
5. `mysql.core.describeTable({table: "test_products"})` → columns include `id`, `name`, `price`
6. `mysql.core.getIndexes({table: "test_orders"})` → verify `idx_orders_status` present

**Create → Use → Drop lifecycle:**

7. `mysql.core.createTable({table: "temp_cm_core", columns: [{name: "id", type: "INT", primaryKey: true}, {name: "val", type: "VARCHAR(50)"}]})` → `success: true`
8. `mysql.core.writeQuery({query: "INSERT INTO temp_cm_core (id, val) VALUES (1, 'test')"})` → `rowsAffected: 1`
9. `mysql.core.readQuery({query: "SELECT * FROM temp_cm_core"})` → 1 row
10. `mysql.core.dropTable({table: "temp_cm_core"})` → `success: true`

**Domain error paths (🔴):**

11. 🔴 `mysql.core.readQuery({query: "SELECT * FROM nonexistent_table_xyz"})` → `{success: false, error: "..."}` — NOT raw exception
12. 🔴 `mysql.core.describeTable({table: "nonexistent_xyz"})` → `{success: false, error: "..."}`
13. 🔴 `mysql.core.readQuery({query: "SELEKT * FROM test_products"})` → `{success: false, error: "..."}` syntax error
14. 🔴 `mysql.core.getIndexes({table: "nonexistent_xyz"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

15. 🔴 `mysql.core.createTable({})` → `{success: false, error: "Validation error: ..."}`
16. 🔴 `mysql.core.describeTable({})` → `{success: false, error: "Validation error: ..."}`
17. 🔴 `mysql.core.readQuery({})` → `{success: false, error: "Validation error: ..."}`

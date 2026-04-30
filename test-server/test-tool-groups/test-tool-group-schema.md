# mysql-mcp Tool Group Testing: [schema]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

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

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Report all failures, unexpected behaviors, or unnecessarily large payloads
5. **Error path testing**: For **every** tool, test at least two invalid inputs: (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}` — NOT raw MCP error.
7. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

All tools must return errors as structured objects instead of throwing:

```json
{ "success": false, "error": "Human-readable error message" }
```

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` — no `success` field | Bug |

### Zod Validation Errors

Test every tool with `{}` if it has required parameters — must return handler error, not raw MCP error.

### Wrong-Type Numeric Parameter Coercion

For tools with optional numeric parameters, call with `param: "abc"`. Must NOT return raw MCP `-32602` error.

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, views with `test_view_*`, drop after testing.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.
- Include total token usage in final summary.

---

## Group Focus: schema

### schema Group-Specific Testing

schema Tool Group (10 tools +1 for code mode):

1. 'mysql_list_schemas'
2. 'mysql_create_schema'
3. 'mysql_drop_schema'
4. 'mysql_list_views'
5. 'mysql_create_view'
6. 'mysql_list_stored_procedures'
7. 'mysql_list_functions'
8. 'mysql_list_triggers'
9. 'mysql_list_constraints'
10. 'mysql_list_events'
11. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY. Compare responses against the expected results. Report any deviation.

1. `mysql_list_schemas()` → verify `testdb`, `information_schema`, `mysql` in results
2. `mysql_list_views({database: "testdb"})` → verify response structure (may be empty)
3. `mysql_list_constraints({table: "test_orders"})` → verify FK to `test_products` appears
4. `mysql_list_triggers({database: "testdb"})` → verify response structure (may be empty)
5. `mysql_list_stored_procedures({database: "testdb"})` → verify response structure
6. `mysql_list_functions({database: "testdb"})` → verify response structure
7. `mysql_list_events({database: "testdb"})` → verify response structure

**Create → Use → Drop lifecycle:**

8. `mysql_create_view({name: "temp_view_order_totals", query: "SELECT product_id, SUM(total_price) AS total FROM test_orders GROUP BY product_id"})` → `{success: true}`
9. `mysql_list_views({database: "testdb"})` → verify `temp_view_order_totals` appears

**Domain error paths (🔴):**

10. 🔴 `mysql_list_constraints({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` or empty results — not raw MCP error
11. 🔴 `mysql_drop_schema({name: "nonexistent_db_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

12. 🔴 `mysql_create_view({})` → `{success: false, error: "Validation error: ..."}` (missing required params)
13. 🔴 `mysql_create_schema({})` → `{success: false, error: "Validation error: ..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

14. 🔴 `mysql_list_constraints({limit: "abc"})` → must NOT return raw MCP `-32602` error

**Cleanup:**

15. Drop `temp_view_order_totals` view via `mysql_write_query({query: "DROP VIEW IF EXISTS temp_view_order_totals"})`

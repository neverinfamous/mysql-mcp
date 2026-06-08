# mysql-mcp Tool Group Testing: [core]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp
- All changes MUST be consistent with `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `_meta.tokenEstimate` for every operation**. Report the response size in tokens/KB and suggest a concrete optimization (e.g., filter system tables, add `compact` option, omit empty arrays).

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload (approximate token count based on ~4 bytes/token). Code Mode responses include `metrics.tokenEstimate` instead. These are injected automatically by the adapter — no per-tool assertions needed, but report as ⚠️ if absent.

## Test Database Schema

The test database (`testdb`) contains these tables:

| Table               | Rows | Key Columns                                                                            | JSON Columns        |
| ------------------- | ---- | -------------------------------------------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                                                              | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM: pending/shipped/completed/cancelled) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                                                                | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                                                     | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role                                                  | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity                                         | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT)                                      | —                   |
| `test_categories`   | 17   | id, name, path, level                                                                  | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date                                       | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)                                                  | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                                                                 | data                |

## Testing Requirements

1. Use existing `test_*` tables for read operations (SELECT, COUNT, queries)
2. Create temporary tables with `temp_*` prefix for write operations
3. Test each tool with realistic inputs based on the schema above
4. Clean up any `temp_*` tables after testing
5. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads
6. Do not mention what already works or issues well documented in ServerInstructions and runtime hints
7. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error (nonexistent table, invalid column, bad parameter value) and (b) a **Zod validation error** (call the tool with `{}` empty params if it has required parameters, or pass the wrong type). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame.
8. **No Scripted Loops**: You must test each error path by writing an individual, distinct tool call.
9. **Pacing**: Test a maximum of 3-5 tools at a time. Report the results, update your matrix, and then move on to the next chunk.

## Structured Error Response Pattern

All tools must return errors as structured objects instead of throwing. A thrown error propagates as a raw MCP error, which is unhelpful to clients. The expected pattern:

```json
{ "success": false, "error": "Human-readable error message" }
```

Some tools use `{ exists: false }` instead of `{ success: false }` for nonexistent objects. The `reason` field is reserved for informational `{ success: true, skipped: true, reason: "..." }` responses only — all error responses use `error`.

### Handler Error vs MCP Error — How to Distinguish

There are two kinds of error responses. Only one is correct:

| Type                 | Source                                                             | What you see                                                                                                          | Verdict            |
| -------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------ |
| **Handler error** ✅ | Handler catches error and returns `{success: false, error: "..."}` | Parseable JSON object with `success` and `error` fields                                                               | Correct            |
| **MCP error** ❌     | Uncaught throw propagates to MCP framework                         | Raw text error string, often prefixed with `Error:`, wrapped in an `isError: true` content block — no `success` field | Bug — report as ❌ |

**Concrete examples:**

```
✅ Handler error (correct):
{"success": false, "error": "Table 'testdb.nonexistent' doesn't exist"}

❌ MCP error (bug — handler threw instead of catching):
content: [{type: "text", text: "Error: ER_NO_SUCH_TABLE: Table 'testdb.nonexistent' doesn't exist"}]
isError: true
```

### Zod Validation Errors

Calling a tool with wrong parameter types or missing required fields triggers a Zod validation error. If the handler has no outer `try/catch`, this surfaces as a raw MCP error (often `-32602`). Test every tool with `{}` (empty params) if it has required parameters — the response must be a handler error, not an MCP error.

### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`, `buckets`, `sampleSize`, `radius`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error. Acceptable behaviors:

- Handler returns `{success: false, error: "..."}` with a validation message
- Handler silently applies the default value (ignoring the malformed input)
- Handler coerces to NaN and returns a descriptive error

Unacceptable: Raw MCP error frame with `-32602` code.

## Split Schema Pattern Verification

All tools use the Split Schema pattern: a plain `z.object()` Base schema for MCP parameter visibility, and a `z.preprocess()` wrapper for handler parsing. Verify:

1. **Parameter visibility**: For tools with optional parameters (e.g., `database`, `limit`), make a direct MCP call using those parameters. If the tool ignores or rejects documented parameters, report as a Split Schema violation.
2. **Alias acceptance**: For tools with documented parameter aliases (e.g., `table`/`tableName`/`name`, `query`/`sql`, `where`/`filter`), verify that direct MCP tool calls correctly accept the aliases — not just the primary parameter name.
3. **`z.preprocess()` as `inputSchema`**: If a tool uses `z.preprocess()` directly as its `inputSchema` (instead of a plain `SchemaBase`), parameter metadata is stripped from JSON Schema generation. Report as a Split Schema violation.

## P154 Object Existence Verification

All tools that accept a table name should return structured error responses for nonexistent tables and databases. For each, verify:

1. **Nonexistent table**: Calling with `table: "nonexistent_table_xyz"` returns a structured error — not a raw MySQL exception
2. **Nonexistent database/schema**: Where applicable, calling with a nonexistent database produces a similarly clear structured error

Key MySQL error codes that should be intercepted by handlers (not leaked as raw errors):

| MySQL Error Code          | Meaning                | Expected Structured Message   |
| ------------------------- | ---------------------- | ----------------------------- |
| 1146 (ER_NO_SUCH_TABLE)   | Table doesn't exist    | `Table 'X' does not exist`    |
| 1049 (ER_BAD_DB_ERROR)    | Database doesn't exist | `Database 'X' does not exist` |
| 1054 (ER_BAD_FIELD_ERROR) | Unknown column         | `Column 'X' not found`        |
| 1064 (ER_PARSE_ERROR)     | SQL syntax error       | `SQL syntax error: ...`       |

## Error Consistency Audit

During testing, check for these inconsistencies:

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌.
2. **Error field name**: All `{ success: false }` error responses should use `error` as the field name.
3. **Zod validation leaks**: If calling a tool with an invalid enum value or missing required field produces a raw MCP `-32602` Zod validation error instead of a structured response, report as ❌.

## Error Path Testing Checklist

For each tool group under test, verify at least one scenario from each applicable row:

| Error Scenario                    | Tool Groups to Test                   | Example Input                                      |
| --------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Nonexistent table                 | All table-accepting tools             | `table: "nonexistent_xyz"`                         |
| Nonexistent database              | Core, schema, admin                   | `database: "fake_db"`                              |
| Invalid SQL syntax                | Core (`read_query`, `write_query`)    | `query: "SELECTT * FROM"`                          |
| Invalid column name               | Stats, JSON, text, spatial            | `column: "nonexistent_col"`                        |
| Duplicate table/index name        | Core (`create_table`, `create_index`) | Create existing table                              |
| **Zod validation (empty params)** | **Every tool with required params**   | `{}` (must return handler error, not MCP `-32602`) |
| **Zod validation (wrong type)**   | **Tools with typed params**           | Pass string where number expected                  |

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_` (e.g., `temp_analysis_results`)
- **Test views**: Prefix with `test_view_` (e.g., `test_view_order_summary`)
- **Test procedures**: Prefix with `test_proc_`

After testing, clean up:

```sql
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'testdb' AND TABLE_NAME LIKE 'temp_%';

DROP TABLE IF EXISTS temp_my_test_table;
```

## Post-Test Procedures

### Reporting Rules

- Use ✅ only in inline notes during testing; omit from Final Summary
- Do not mention what already works well or issues already documented in ServerInstructions and runtime hints

### After Testing

1. **Token Audit**: Use `read_resource` on `mysql://audit` to retrieve total token usage. Include in your final report.
2. **Cleanup**: Confirm all `temp_*` tables and temporary testing data are removed.
3. **Fix EVERY finding** — not just ❌ Fails, but also ⚠️ Issues and 📦 Payload problems.
4. **Read `../code-map.md` before making changes and make all changes consistent with other tools.**
5. **Scope of fixes** includes corrections to any of:
   - Handler code
   - `ServerInstructions.ts`
   - Test database (`test-seed.sql`)
   - This prompt
6. Update the changelog if there were any changes made (being careful not to create duplicate headers), and commit without pushing.
7. Stop and briefly summarize the testing results and fixes, ensuring the total token count is prominently displayed.

---

## Group Focus: core

### core Group-Specific Testing

core Tool Group (8 tools +1 for code mode):

1. 'mysql_read_query'
2. 'mysql_write_query'
3. 'mysql_list_tables'
4. 'mysql_describe_table'
5. 'mysql_create_table'
6. 'mysql_drop_table'
7. 'mysql_create_index'
8. 'mysql_get_indexes'
9. 'mysql_execute_code' (codemode, auto-added)

All tools implement P154 structured error handling for nonexistent tables. Test with `test_products` and `test_orders`.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY. Compare responses against the expected results. Report any deviation. These are the minimum-bar tests that must pass every run — freeform testing comes after.

**Read/Write/Schema tools:**

1. `mysql_read_query({query: "SELECT COUNT(*) AS n FROM test_orders"})` → `{rows: [{n: 20}], rowCount: 1}`
2. `mysql_read_query({query: "SELECT id, name, price FROM test_products WHERE price > 50 LIMIT 3"})` → 3 rows with valid data
3. `mysql_read_query({query: "SELECT * FROM test_measurements", stream: true, chunkSize: 50})` → verify returns `{streamed: true, chunksEmitted: 4, rowCount: 200}`
4. `mysql_list_tables({database: "testdb", limit: 5})` → `{tables: [...], count: 5, truncated: true}`
4. `mysql_describe_table({table: "test_products"})` → verify `columns` includes `id`, `name`, `price`, `category`, `metadata`; `primaryKey` present
5. `mysql_get_indexes({table: "test_orders"})` → verify `idx_orders_status` and `idx_orders_date` in results
6. `mysql_list_tables({database: "testdb"})` → verify ≥11 test tables present

**Domain error paths (🔴):**

7. 🔴 `mysql_read_query({query: "SELECT * FROM nonexistent_table_xyz"})` → `{success: false, error: "..."}` mentioning table name — NOT raw MCP error
8. 🔴 `mysql_write_query({query: "INSERT INTO nonexistent_xyz VALUES (1)"})` → `{success: false, error: "..."}` handler error
9. 🔴 `mysql_read_query({query: "SELECT nonexistent_col FROM test_products"})` → `{success: false, error: "..."}` mentioning column name
10. 🔴 `mysql_describe_table({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` mentioning table name
11. 🔴 `mysql_get_indexes({table: "nonexistent_table_xyz"})` → `{success: false, error: "..."}` handler error
12. 🔴 `mysql_read_query({query: "SELEKT * FROM test_products"})` → `{success: false, error: "..."}` SQL syntax error

**Zod validation error paths (🔴 — verify `"Validation error: ..."` format, NOT raw JSON array):**

13. 🔴 `mysql_create_table({})` → `{success: false, error: "Validation error: ..."}` — NOT raw MCP error
14. 🔴 `mysql_describe_table({})` → `{success: false, error: "Validation error: ..."}` (missing required `table`)
15. 🔴 `mysql_read_query({})` → `{success: false, error: "Validation error: ..."}` (missing required `query`)
16. 🔴 `mysql_write_query({})` → `{success: false, error: "Validation error: ..."}` (missing required `query`)
17. 🔴 `mysql_create_index({})` → `{success: false, error: "Validation error: ..."}` (missing required params)
18. 🔴 `mysql_drop_table({})` → `{success: false, error: "Validation error: ..."}` (missing required `table`)

**Wrong-type numeric param coercion (🔴):**

19. 🔴 `mysql_list_tables({limit: "abc"})` → must NOT return raw MCP `-32602` error — should return handler error or silently default `limit`
20. 🔴 `mysql_read_query({query: "SELECT * FROM test_products", limit: "abc"})` → must NOT return raw MCP error

**Alias acceptance (verify aliases produce identical results):**

21. `mysql_read_query({sql: "SELECT 1 AS test"})` → works via `sql` alias for `query`
22. `mysql_describe_table({name: "test_products"})` → works via `name` alias for `table`
23. `mysql_describe_table({tableName: "test_products"})` → works via `tableName` alias for `table`
24. `mysql_drop_table({name: "temp_alias_test", ifExists: true})` → works via `name` alias

**Create → Use → Drop lifecycle (temp tables):**

25. `mysql_create_table({table: "temp_lifecycle", columns: [{name: "id", type: "INT", primaryKey: true, autoIncrement: true}, {name: "name", type: "VARCHAR(100)", notNull: true}]})` → `{success: true}`
26. `mysql_write_query({query: "INSERT INTO temp_lifecycle (name) VALUES ('Alice'), ('Bob')"})` → `{rowsAffected: 2}`
27. `mysql_read_query({query: "SELECT COUNT(*) AS n FROM temp_lifecycle"})` → `{rows: [{n: 2}]}`
28. `mysql_create_index({table: "temp_lifecycle", columns: ["name"], name: "idx_temp_name"})` → `{success: true}`
29. `mysql_get_indexes({table: "temp_lifecycle"})` → verify `idx_temp_name` appears
30. `mysql_drop_table({table: "temp_lifecycle", ifExists: true})` → `{success: true}`
31. `mysql_drop_table({table: "temp_lifecycle", ifExists: true})` → `{success: true}` or `{existed: false}` (already dropped)

# MySQL-MCP Test Database Guide

## Reset mysql-mcp Test Database

```powershell
.\test-server\reset-database.ps1
```

## Connection Details

| Property  | Value         |
| --------- | ------------- |
| Host      | `localhost`   |
| Port      | `3306`        |
| User      | `root`        |
| Password  | `root`        |
| Database  | `testdb`      |
| Container | `mysql-final` |

---

**Step 1:** Read the entire `C:\Users\chris\Desktop\mysql-mcp\src\constants\ServerInstructions.ts` using `view_file` — to understand documented behaviors, edge cases, and response structures for this tool group. Do not rely on grep or search.

**Step 2:** Read the deterministic checklist for your target group from the appropriate `test-group-tools-*.md` file:

| File | Groups Covered |
|---|---|
| `test-group-tools-core.md` | core, transactions, schema |
| `test-group-tools-data.md` | json, fulltext, document, text, stats |
| `test-group-tools-admin.md` | admin, monitoring, performance, optimization, security, roles, backup, replication, sys |
| `test-group-tools-ext.md` | spatial, partitioning, events |
| `test-group-tools-ecosystem.md` | cluster, proxysql, router, shell |

**Step 3:** Execute checklist items first (minimum bar), then proceed with freeform exploration using the requirements below.

### Test Database Schema

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

### Testing Requirements

1. Use existing `test_*` tables for read operations (SELECT, COUNT, queries)
2. Create temporary tables with `temp_*` prefix for write operations
3. Test each tool with realistic inputs based on the schema above
4. Use `test-server/sample.csv` for CSV/import tool testing
5. Clean up any `temp_*` tables after testing
6. Report all failures, unexpected behaviors, improvement opportunities, or unnecessarily large payloads
7. Do not mention what already works or issues well documented in ServerInstructions and runtime hints
8. **Error path testing**: For **every** tool, test at least **two** invalid inputs: (a) a domain error (nonexistent table, invalid column, bad parameter value) and (b) a **Zod validation error** (call the tool with `{}` empty params if it has required parameters, or pass the wrong type). Both must return a **structured handler error** (`{success: false, error: "..."}`) — NOT a raw MCP error frame. See the "Structured Error Response Pattern" section below for how to distinguish the two. This is the most common deficiency found across tool groups.

### Structured Error Response Pattern

All tools must return errors as structured objects instead of throwing. A thrown error propagates as a raw MCP error, which is unhelpful to clients. The expected pattern:

```json
{ "success": false, "error": "Human-readable error message" }
```

Some tools use `{ exists: false }` instead of `{ success: false }` for nonexistent objects. The `reason` field is reserved for informational `{ success: true, skipped: true, reason: "..." }` responses only — all error responses use `error`.

#### Handler Error vs MCP Error — How to Distinguish

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

The MCP error case means the handler is missing a `try/catch` block. When testing, if you see a raw error string (especially one containing MySQL error codes like `ER_NO_SUCH_TABLE` without a `success` field), report it as ❌.

#### Zod Validation Errors

Calling a tool with wrong parameter types or missing required fields triggers a Zod validation error. If the handler has no outer `try/catch`, this surfaces as a raw MCP error (often `-32602`). Test every tool with `{}` (empty params) if it has required parameters — the response must be a handler error, not an MCP error.

#### Wrong-Type Numeric Parameter Coercion

For every tool with optional numeric parameters (e.g., `limit`, `buckets`, `sampleSize`, `radius`), call the tool with `param: "abc"` (string instead of number). The tool must NOT return a raw MCP `-32602` error. Acceptable behaviors:

- Handler returns `{success: false, error: "..."}` with a validation message
- Handler silently applies the default value (ignoring the malformed input)
- Handler coerces to NaN and returns a descriptive error

Unacceptable: Raw MCP error frame with `-32602` code.

**What to report:**

- If a tool call returns a raw MCP error (no JSON body with `success` field), report it as ❌ with the tool name and the raw error message
- If a tool returns `{success: false, error: "..."}`, that is the correct behavior — do not report it as a failure
- If a tool returns a successful response for an obviously invalid input (e.g., nonexistent table returns `{success: true}`), report as ⚠️

### P154 Object Existence Verification

All tools that accept a table name should return structured error responses for nonexistent tables and databases. Core tools (`mysql_describe_table`, `mysql_drop_table`, `mysql_get_indexes`, `mysql_create_index`) serve as canonical P154 verification targets, but this applies to **every tool group**. For each, verify:

1. **Nonexistent table**: Calling with `table: "nonexistent_table_xyz"` returns a structured error like `{success: false, error: "Table 'testdb.nonexistent_table_xyz' doesn't exist"}` — not a raw MySQL exception
2. **Nonexistent database/schema**: Where applicable, calling with a nonexistent database (e.g., `database: "fake_db"`) produces a similarly clear structured error
3. **Silent empty results**: Tools that silently return `{count: 0}` or `{rows: []}` for nonexistent tables (instead of surfacing that the table doesn't exist) should be reported as ⚠️

Key MySQL error codes that should be intercepted by handlers (not leaked as raw errors):

| MySQL Error Code          | Meaning                | Expected Structured Message                        |
| ------------------------- | ---------------------- | -------------------------------------------------- |
| 1146 (ER_NO_SUCH_TABLE)   | Table doesn't exist    | `Table 'X' does not exist`                         |
| 1049 (ER_BAD_DB_ERROR)    | Database doesn't exist | `Database 'X' does not exist`                      |
| 1051 (ER_BAD_TABLE_ERROR) | Unknown table          | `Table 'X' does not exist`                         |
| 1062 (ER_DUP_ENTRY)       | Duplicate key          | `Duplicate entry: ... Use ON DUPLICATE KEY UPDATE` |
| 1061 (ER_DUP_KEYNAME)     | Duplicate index name   | `Index 'X' already exists`                         |
| 1054 (ER_BAD_FIELD_ERROR) | Unknown column         | `Column 'X' not found`                             |
| 1064 (ER_PARSE_ERROR)     | SQL syntax error       | `SQL syntax error: ...`                            |

### Error Consistency Audit

During testing, check for these inconsistencies across tool groups:

1. **Throw-vs-return**: If a tool throws a raw error instead of returning `{success: false}`, report as ❌. Document which tool groups have the worst raw-error leakage.
2. **Error field name**: All `{ success: false }` error responses should use `error` as the field name. The `reason` field is reserved for `{ success: true, skipped: true }` informational responses. If a tool uses `reason` in an error context, report as ⚠️.
3. **Zod validation leaks**: If calling a tool with an invalid enum value or missing required field produces a raw MCP `-32602` Zod validation error instead of a structured response, report as ❌. This indicates the Zod schema is rejecting the input at the MCP framework level before the handler's `try/catch` can intercept.
4. **Missing centralized error parser**: mysql-mcp lacks a `parseMysqlError`/`formatMysqlError` equivalent (compare: postgres-mcp has a 425-line centralized error parser). Document which tool groups have the worst ad-hoc error formatting to prioritize infrastructure work.

### Split Schema Pattern Verification

All tools use the Split Schema pattern: a plain `z.object()` Base schema for MCP parameter visibility, and a `z.preprocess()` wrapper for handler parsing. Verify:

1. **Parameter visibility**: For tools with optional parameters (e.g., `database`, `limit`), make a direct MCP call using those parameters. If the tool ignores or rejects documented parameters, report as a Split Schema violation.
2. **Alias acceptance**: For tools with documented parameter aliases (e.g., `table`/`tableName`/`name`, `query`/`sql`, `where`/`filter`), verify that direct MCP tool calls correctly accept the aliases — not just the primary parameter name. If a direct call using only an alias fails with a validation error like "table is required", report as a Split Schema violation.
3. **`z.preprocess()` as `inputSchema`**: If a tool uses `z.preprocess()` directly as its `inputSchema` (instead of a plain `SchemaBase`), parameter metadata is stripped from JSON Schema generation, making direct MCP calls unable to see or use those parameters. Report as a Split Schema violation.

### Error Path Testing Checklist

For each tool group under test, verify at least one scenario from each applicable row:

| Error Scenario                    | Tool Groups to Test                   | Example Input                                                           |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| Nonexistent table                 | All table-accepting tools             | `table: "nonexistent_xyz"`                                              |
| Nonexistent database              | Core, schema, admin                   | `database: "fake_db"`                                                   |
| Duplicate table/index name        | Core (`create_table`, `create_index`) | Create existing table without `ifNotExists`                             |
| Invalid SQL syntax                | Core (`read_query`, `write_query`)    | `query: "SELECTT * FROM"`                                               |
| Invalid column name               | Stats, JSON, text, spatial            | `column: "nonexistent_col"`                                             |
| Invalid enum/type value           | Events, partitioning                  | Invalid event type or status                                            |
| Empty required array              | Transactions                          | `statements: []`                                                        |
| Missing required field via alias  | Core, transactions                    | `sql` alias instead of `query`                                          |
| **Zod validation (empty params)** | **Every tool with required params**   | `{}` (empty object — must return handler error, not MCP `-32602` error) |
| **Zod validation (wrong type)**   | **Tools with typed params**           | Pass string where number expected, etc.                                 |

### Cleanup Conventions

During testing, use these naming conventions:

- **Temporary tables**: Prefix with `temp_` (e.g., `temp_analysis_results`)
- **Test views**: Prefix with `test_view_` (e.g., `test_view_order_summary`)
- **Test procedures**: Prefix with `test_proc_` (e.g., `test_proc_calculate`)

After testing, clean up:

```sql
-- List temp tables
SELECT TABLE_NAME FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'testdb' AND TABLE_NAME LIKE 'temp_%';

-- Drop temp table
DROP TABLE IF EXISTS temp_my_test_table;
```

**Notes:**

> Use `temp_*` prefix for any created tables. Test with `test_products` and `test_orders`.
> `temp_write_test` is created by the seed script (`test-seed.sql`) and will appear in `temp_%` cleanup queries. It is **not** leftover from testing — do not drop it during cleanup.

### Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that could be optimized

### Final Summary

At the end, ONLY provide a list of any issues found, recommended fixes or improvements, and any deficiencies or inaccuracies in ServerInstructions.ts or in this prompt: C:\Users\chris\Desktop\mysql-mcp\test-server\test-tools.md. Use ✅ only in inline notes during testing; omit from Final Summary. Confirm cleanup of temporary testing data is complete.

---

### Group-Specific Test Data & Notes

Detailed group-specific test data references, checklists, and notes are in the `test-group-tools-*.md` files. Quick reference:

| Group | Key Test Data | Notes |
|---|---|---|
| json | `test_json_docs` (doc, metadata, tags columns) | Nested access: `doc.nested.level1.level2` |
| fulltext | `test_articles` (FULLTEXT on title, body) | Terms: MySQL, database, JSON, FTS, MCP |
| partitioning | `test_partitioned` (4 LIST COLUMNS partitions) | Regions: east, west, central, south, + variants |
| spatial | `test_locations.geom` (POINT, SRID 4326) | Cities: NYC, Paris, London, Tokyo, Sydney, SF |
| cluster | InnoDB Cluster (port 3307) | Requires cluster infrastructure |
| proxysql | Admin port 6032, radmin/radmin | Requires ProxySQL container |
| router | HTTPS port 8443, `MYSQL_ROUTER_INSECURE=true` | Requires InnoDB Cluster |
| shell | MySQL Shell 8.0+ | Works with standard config |

See `C:\Users\chris\Desktop\adamic\docs\mysql-ecosystem-docker-setup.md` for ecosystem setup.

---

## Troubleshooting

### Database is locked / connection refused

1. Ensure mysql-final container is running: `docker ps | grep mysql-final`
2. Start if needed: `docker start mysql-final`
3. Check port binding: `docker port mysql-final`

### Reset script fails

1. Run with `-Verbose` to see detailed output
2. Try manual reset: `docker exec -i mysql-final mysql -uroot -proot testdb < test-seed.sql`

### Spatial functions fail

Ensure MySQL 8.0+ and check SRID: `SELECT ST_SRID(geom) FROM test_locations LIMIT 1;`

### Partitioning tools fail

Verify partitions exist: `SELECT PARTITION_NAME FROM information_schema.PARTITIONS WHERE TABLE_NAME = 'test_partitioned';`

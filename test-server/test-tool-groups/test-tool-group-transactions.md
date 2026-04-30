# mysql-mcp Tool Group Testing: [transactions]

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

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: transactions

### transactions Group-Specific Testing

transactions Tool Group (7 tools +1 for code mode):

1. 'mysql_transaction_begin'
2. 'mysql_transaction_commit'
3. 'mysql_transaction_rollback'
4. 'mysql_transaction_savepoint'
5. 'mysql_transaction_release'
6. 'mysql_transaction_rollback_to'
7. 'mysql_transaction_execute'
8. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY. Compare responses against the expected results. Report any deviation.

1. `mysql_transaction_begin()` → capture `transactionId`
2. `mysql_read_query({query: "SELECT 1 AS test", transactionId: <id>})` → `{rows: [{test: 1}]}`
3. `mysql_transaction_savepoint({transactionId: <id>, name: "checklist_sp1"})` → `{success: true}`
4. `mysql_transaction_rollback_to({transactionId: <id>, name: "checklist_sp1"})` → `{success: true}`
5. `mysql_transaction_release({transactionId: <id>, name: "checklist_sp1"})` → note behavior
6. `mysql_transaction_commit({transactionId: <id>})` → `{success: true}`
7. `mysql_transaction_execute({statements: [{sql: "SELECT 1 AS a"}, {sql: "SELECT 2 AS b"}]})` → `{success: true, statementsExecuted: 2}`

**Domain error paths (🔴):**

8. 🔴 `mysql_transaction_commit({transactionId: "nonexistent-uuid"})` → `{success: false, error: "..."}` handler error
9. 🔴 `mysql_transaction_rollback({transactionId: "nonexistent-uuid"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

10. 🔴 `mysql_transaction_execute({})` → `{success: false, error: "..."}` (missing `statements`)
11. 🔴 `mysql_transaction_savepoint({})` → `{success: false, error: "..."}` (missing required params)
12. 🔴 `mysql_transaction_rollback_to({})` → `{success: false, error: "..."}` (missing required params)

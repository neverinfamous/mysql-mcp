# mysql-mcp Tool Group Testing: [performance]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|-------|------|-------------|--------------|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_measurements` | 200 | id, sensor_id (INT 1-5), temperature, humidity | — |

## Testing Requirements

1. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`).
2. **Strict Coverage Matrix**: Track progress in `tmp/task.md`.
3. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: performance

### performance Group-Specific Testing

performance Tool Group (8 tools +1 for code mode):

1. 'mysql_explain'
2. 'mysql_explain_analyze'
3. 'mysql_slow_queries'
4. 'mysql_query_stats'
5. 'mysql_index_usage'
6. 'mysql_table_stats'
7. 'mysql_buffer_pool_stats'
8. 'mysql_thread_stats'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_explain({query: "SELECT * FROM test_products WHERE id = 1"})` → verify execution plan returned
2. `mysql_explain({query: "SELECT * FROM test_products WHERE id = 1", format: "JSON"})` → verify JSON-format plan
3. `mysql_table_stats({table: "test_products"})` → verify `{rows, avgRowLength, dataLength}` present
4. `mysql_index_usage({table: "test_products"})` → verify index usage statistics
5. `mysql_buffer_pool_stats()` → verify buffer pool metrics
6. `mysql_thread_stats()` → verify thread statistics
7. `mysql_query_stats({limit: 3})` → verify top query statistics

**Domain error paths (🔴):**

8. 🔴 `mysql_table_stats({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error (P154)
9. 🔴 `mysql_explain({query: "SELEKT * FROM test_products"})` → `{success: false, error: "..."}` syntax error

**Zod validation error paths (🔴):**

10. 🔴 `mysql_explain({})` → `{success: false, error: "..."}` (missing required `query`)
11. 🔴 `mysql_table_stats({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

12. 🔴 `mysql_query_stats({limit: "abc"})` → must NOT return raw MCP error
13. 🔴 `mysql_slow_queries({limit: "abc"})` → must NOT return raw MCP error

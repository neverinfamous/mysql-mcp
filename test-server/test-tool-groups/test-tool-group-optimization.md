# mysql-mcp Tool Group Testing: [optimization]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

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
| `test_categories`   | 17   | id, name, path, level                             | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |

## Structured Error Response Pattern

| Type                 | What you see                                     | Verdict |
| -------------------- | ------------------------------------------------ | ------- |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌     | Raw text error string with `isError: true`       | Bug     |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: optimization

### optimization Group-Specific Testing

optimization Tool Group (4 tools +1 for code mode):

1. 'mysql_index_recommendation'
2. 'mysql_query_rewrite'
3. 'mysql_force_index'
4. 'mysql_optimizer_trace'
5. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_index_recommendation({table: "test_orders"})` → verify recommendations returned, including missing FK checks and duplicate index checks
2. `mysql_index_recommendation({queries: ["SELECT * FROM test_products WHERE category = 'Electronics'"]})` → verify EXPLAIN-based composite recommendations
3. `mysql_index_recommendation({table: "test_orders", queries: ["SELECT * FROM test_orders WHERE status = 'completed' AND customer_name = 'Alice'"]})` → verify composite index suggestion for multi-column WHERE
4. `mysql_index_recommendation({})` → verify database-wide audit runs (table is optional)
5. `mysql_query_rewrite({query: "SELECT * FROM test_products WHERE name = 'Laptop'"})` → verify optimization hints
6. `mysql_force_index({table: "test_orders", index: "idx_orders_status", query: "SELECT * FROM test_orders WHERE status = 'completed'"})` → verify FORCE INDEX hint
7. `mysql_optimizer_trace({query: "SELECT * FROM test_products WHERE id = 1"})` → verify trace output
8. `mysql_optimizer_trace({query: "SELECT * FROM test_products WHERE id = 1", summary: true})` → verify summarized trace

**Domain error paths (🔴):**

9. 🔴 `mysql_index_recommendation({queries: ["INSERT INTO test_products VALUES (999, 'x', 1, 'cat', '{}')"]})` → verify DML rejection
10. 🔴 `mysql_index_recommendation({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

11. 🔴 `mysql_index_recommendation({queries: "SELECT 1"})` → `{success: false, error: "..."}` (Zod validation, queries must be array)
12. 🔴 `mysql_optimizer_trace({})` → `{success: false, error: "..."}` (missing required `query`)

# mysql-mcp Tool Group Testing: [sys]

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

## Group Focus: sys

### sys Group-Specific Testing

sys Tool Group (8 tools +1 for code mode):

1. 'mysql_sys_user_summary'
2. 'mysql_sys_io_summary'
3. 'mysql_sys_statement_summary'
4. 'mysql_sys_wait_summary'
5. 'mysql_sys_innodb_lock_waits'
6. 'mysql_sys_schema_stats'
7. 'mysql_sys_host_summary'
8. 'mysql_sys_memory_summary'
9. 'mysql_execute_code' (codemode, auto-added)

> **Note**: These tools query the `sys` schema. Results depend on server activity. Focus on verifying response structure and error handling.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_sys_user_summary()` → verify user resource usage structure
2. `mysql_sys_io_summary()` → verify I/O metrics structure
3. `mysql_sys_statement_summary()` → verify statement analysis
4. `mysql_sys_wait_summary()` → verify wait events analysis
5. `mysql_sys_innodb_lock_waits()` → verify response (may be empty if no locks)
6. `mysql_sys_schema_stats()` → verify table/index size information
7. `mysql_sys_host_summary()` → verify host-based metrics
8. `mysql_sys_memory_summary()` → verify memory usage breakdown

**Wrong-type numeric param coercion (🔴):**

9. 🔴 `mysql_sys_statement_summary({limit: "abc"})` → must NOT return raw MCP error
10. 🔴 `mysql_sys_schema_stats({limit: "abc"})` → must NOT return raw MCP error

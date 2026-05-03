# mysql-mcp Tool Group Testing: [replication]

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

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: replication

### replication Group-Specific Testing

replication Tool Group (5 tools +1 for code mode):

1. 'mysql_master_status'
2. 'mysql_slave_status'
3. 'mysql_binlog_events'
4. 'mysql_gtid_status'
5. 'mysql_replication_lag'
6. 'mysql_execute_code' (codemode, auto-added)

> **Note**: These tools query replication state. In a single-server test environment, most will return empty or status-only results. The focus is on verifying structured error responses and no raw MCP leakage.

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_master_status()` → verify response structure (binlog file, position)
2. `mysql_slave_status()` → verify response structure (may indicate no replication)
3. `mysql_gtid_status()` → verify GTID information
4. `mysql_binlog_events({limit: 5})` → verify binlog events listed (may be empty)
5. `mysql_replication_lag()` → verify response (0 lag or no-replica message)

**Zod validation error paths (🔴):**

6. 🔴 `mysql_binlog_events({logFile: 123})` → must NOT return raw MCP error (wrong type — expected string)

**Wrong-type numeric param coercion (🔴):**

7. 🔴 `mysql_binlog_events({limit: "abc"})` → must NOT return raw MCP `-32602` error

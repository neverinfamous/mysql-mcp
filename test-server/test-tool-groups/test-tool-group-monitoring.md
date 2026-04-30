# mysql-mcp Tool Group Testing: [monitoring]

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
3. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: monitoring

### monitoring Group-Specific Testing

monitoring Tool Group (7 tools +1 for code mode):

1. 'mysql_show_processlist'
2. 'mysql_show_status'
3. 'mysql_show_variables'
4. 'mysql_innodb_status'
5. 'mysql_replication_status'
6. 'mysql_pool_stats'
7. 'mysql_server_health'
8. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_show_processlist()` → verify at least 1 active connection
2. `mysql_show_status({like: "Uptime"})` → verify `Uptime > 0`
3. `mysql_show_variables({like: "max_connections"})` → verify numeric value
4. `mysql_innodb_status()` → verify InnoDB status output
5. `mysql_innodb_status({summary: true})` → verify summarized output (smaller payload)
6. `mysql_pool_stats()` → verify connection pool statistics
7. `mysql_server_health()` → verify `{status: "..."}` with health assessment

**Domain error paths (🔴):**

8. 🔴 `mysql_show_status({like: "nonexistent_var_xyz"})` → empty results or structured error — not raw MCP error

**Wrong-type numeric param coercion (🔴):**

9. 🔴 `mysql_show_variables({limit: "abc"})` → must NOT return raw MCP error (wrong-type numeric param)

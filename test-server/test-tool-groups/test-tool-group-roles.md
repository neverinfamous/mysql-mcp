# mysql-mcp Tool Group Testing: [roles]

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

| Type                 | What you see                                     | Verdict |
| -------------------- | ------------------------------------------------ | ------- |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌     | Raw text error string with `isError: true`       | Bug     |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: roles

### roles Group-Specific Testing

roles Tool Group (8 tools +1 for code mode):

1. 'mysql_role_list'
2. 'mysql_role_create'
3. 'mysql_role_drop'
4. 'mysql_role_grants'
5. 'mysql_role_grant'
6. 'mysql_role_assign'
7. 'mysql_role_revoke'
8. 'mysql_user_roles'
9. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_role_list()` → verify response structure (may be empty)

**Create → Use → Drop lifecycle:**

2. `mysql_role_create({name: "temp_test_role"})` → `{success: true}`
3. `mysql_role_grants({role: "temp_test_role"})` → verify grants (initially empty)
4. `mysql_role_grant({role: "temp_test_role", privilege: "SELECT", on: "testdb.*"})` → `{success: true}`
5. `mysql_role_grants({role: "temp_test_role"})` → verify SELECT privilege appears
6. `mysql_role_drop({name: "temp_test_role"})` → `{success: true}`

**Domain error paths (🔴):**

7. 🔴 `mysql_role_grants({role: "nonexistent_role_xyz"})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_role_drop({name: "nonexistent_role_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

9. 🔴 `mysql_role_create({})` → `{success: false, error: "..."}` (Zod validation)
10. 🔴 `mysql_role_grant({})` → `{success: false, error: "..."}` (missing required params)

# mysql-mcp Tool Group Testing: [text]

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
4. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
6. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: text

### text Group-Specific Testing

text Tool Group (6 tools +1 for code mode):

1. 'mysql_regexp_match'
2. 'mysql_like_search'
3. 'mysql_soundex'
4. 'mysql_substring'
5. 'mysql_concat'
6. 'mysql_collation_convert'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

**Test data:** Uses `test_users` (10 rows: username, email, phone, bio, role) and `test_products` (16 rows).

**Checklist:**

1. `mysql_regexp_match({table: "test_users", column: "email", pattern: "^[a-z]+\\.[a-z]+@"})` → verify matching dotted emails
2. `mysql_like_search({table: "test_products", column: "name", pattern: "%Laptop%"})` → results matching "Laptop"
3. `mysql_soundex({table: "test_users", column: "username", value: "john"})` → verify phonetic matches
4. `mysql_substring({table: "test_users", column: "email", start: 1, length: 5})` → first 5 chars of each email
5. `mysql_concat({table: "test_users", columns: ["username", "email"], separator: " - "})` → concatenated values

**Domain error paths (🔴):**

6. 🔴 `mysql_regexp_match({table: "nonexistent_xyz", column: "x", pattern: "."})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_like_search({table: "test_users", column: "nonexistent_col", pattern: "%test%"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

8. 🔴 `mysql_regexp_match({})` → `{success: false, error: "..."}` (Zod validation)
9. 🔴 `mysql_like_search({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

10. 🔴 `mysql_substring({table: "test_users", column: "email", start: "abc", length: 5})` → must NOT return raw MCP error
11. 🔴 `mysql_like_search({table: "test_users", column: "email", pattern: "%@%", limit: "abc"})` → must NOT return raw MCP error

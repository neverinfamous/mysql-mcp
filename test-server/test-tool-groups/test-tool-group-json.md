# mysql-mcp Tool Group Testing: [json]

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
6. **Strict Coverage Matrix**: Track progress in `tmp/task.md` for EVERY tool.
7. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` — no `success` field | Bug |

### Zod Validation / Wrong-Type Coercion

- Test every tool with `{}` if it has required parameters — must return handler error.
- For optional numeric params, call with `param: "abc"` — must NOT return raw MCP `-32602`.

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.
- Include total token usage in final summary.

---

## Group Focus: json

### json Group-Specific Testing

json Tool Group (17 tools +1 for code mode):

1. 'mysql_json_extract'
2. 'mysql_json_set'
3. 'mysql_json_insert'
4. 'mysql_json_replace'
5. 'mysql_json_remove'
6. 'mysql_json_contains'
7. 'mysql_json_keys'
8. 'mysql_json_array_append'
9. 'mysql_json_get'
10. 'mysql_json_update'
11. 'mysql_json_search'
12. 'mysql_json_validate'
13. 'mysql_json_merge'
14. 'mysql_json_diff'
15. 'mysql_json_normalize'
16. 'mysql_json_stats'
17. 'mysql_json_index_suggest'
18. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

**Test data:** Use `test_json_docs` table which has these JSON structures:

- `doc`: `{"type": "article", "title": "...", "author": "...", "views": N}`
- `metadata`: `{"source": "blog", "language": "en", "version": N}`
- `tags`: `["database", "tutorial", "beginner"]`
- Nested access: row with `doc.nested.level1.level2`

**Checklist:**

1. `mysql_json_extract({table: "test_json_docs", column: "doc", path: "$.author", where: "id = 1"})` → result contains author name
2. `mysql_json_extract({table: "test_json_docs", column: "doc", path: "$.views", where: "id = 1"})` → numeric value
3. `mysql_json_keys({table: "test_json_docs", column: "doc", where: "id = 1"})` → keys include `type`, `title`, `author`, `views`
4. `mysql_json_validate({value: "{\"valid\": true}"})` → `{valid: true}`
5. `mysql_json_validate({value: "{invalid json"})` → `{valid: false}`
6. `mysql_json_contains({table: "test_json_docs", column: "doc", contains: {"type": "article"}, where: "id = 1"})` → true
7. `mysql_json_stats({table: "test_json_docs", column: "doc"})` → verify `topKeys` present
8. `mysql_json_diff({doc1: {"a": 1, "b": 2}, doc2: {"a": 1, "c": 3}})` → verify differences detected
9. `mysql_json_index_suggest({table: "test_json_docs", column: "doc"})` → verify suggestions returned

**Domain error paths (🔴):**

10. 🔴 `mysql_json_extract({table: "nonexistent_xyz", column: "doc", path: "$.x"})` → `{success: false, error: "..."}` handler error
11. 🔴 `mysql_json_extract({table: "test_json_docs", column: "nonexistent_col", path: "$.x"})` → `{success: false, error: "..."}` mentioning column

**Zod validation error paths (🔴):**

12. 🔴 `mysql_json_keys({})` → `{success: false, error: "..."}` (Zod validation)
13. 🔴 `mysql_json_extract({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

14. 🔴 `mysql_json_stats({table: "test_json_docs", column: "doc", sampleSize: "abc"})` → must NOT return raw MCP `-32602` error
15. 🔴 `mysql_json_contains({table: "test_json_docs", column: "doc", contains: {"type": "article"}, limit: "abc"})` → must NOT return raw MCP error

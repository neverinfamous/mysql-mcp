# mysql-mcp Tool Group Testing: [document]

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
4. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}` — NOT raw MCP error.
5. **Strict Coverage Matrix**: Track progress in `tmp/task.md`.
6. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` — no `success` field | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table/collection names must return structured errors for nonexistent objects.
- Prefix temp collections with `temp_*`, drop after testing.
- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: document

### document Group-Specific Testing

document Tool Group (9 tools +1 for code mode):

1. 'mysql_doc_list_collections'
2. 'mysql_doc_create_collection'
3. 'mysql_doc_drop_collection'
4. 'mysql_doc_find'
5. 'mysql_doc_add'
6. 'mysql_doc_modify'
7. 'mysql_doc_remove'
8. 'mysql_doc_create_index'
9. 'mysql_doc_collection_info'
10. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

**Test data:** Uses `test_documents` (10 rows, collection_name, doc JSON, _id UUID).

**Checklist:**

1. `mysql_doc_list_collections()` → verify `test_documents` appears in results
2. `mysql_doc_find({collection: "test_documents", limit: 3})` → verify 3 documents returned with `_id` fields
3. `mysql_doc_collection_info({collection: "test_documents"})` → verify `{count: 10, ...}` or similar structure

**Create → Use → Drop lifecycle:**

4. `mysql_doc_create_collection({name: "temp_doc_test"})` → `{success: true}`
5. `mysql_doc_add({collection: "temp_doc_test", documents: [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]})` → verify 2 documents added
6. `mysql_doc_find({collection: "temp_doc_test"})` → verify 2 documents
7. `mysql_doc_modify({collection: "temp_doc_test", criteria: {"name": "Alice"}, update: {"age": 31}})` → verify update
8. `mysql_doc_remove({collection: "temp_doc_test", criteria: {"name": "Bob"}})` → verify removal
9. `mysql_doc_drop_collection({name: "temp_doc_test"})` → `{success: true}`

**Domain error paths (🔴):**

10. 🔴 `mysql_doc_find({collection: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error
11. 🔴 `mysql_doc_collection_info({collection: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

12. 🔴 `mysql_doc_add({})` → `{success: false, error: "..."}` (missing required params)
13. 🔴 `mysql_doc_create_collection({})` → `{success: false, error: "..."}` (missing required `name`)

**Wrong-type numeric param coercion (🔴):**

14. 🔴 `mysql_doc_find({collection: "test_documents", limit: "abc"})` → must NOT return raw MCP error

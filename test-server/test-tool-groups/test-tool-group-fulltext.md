# mysql-mcp Tool Group Testing: [fulltext]

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
4. **Error path testing**: For **every** tool, test at least two invalid inputs: (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}` — NOT raw MCP error.
5. **Strict Coverage Matrix**: Track progress in `tmp/task.md` for EVERY tool.
6. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` — no `success` field | Bug |

### Zod / Wrong-Type Coercion

- Test every tool with `{}` if it has required parameters — must return handler error.
- For optional numeric params, call with `param: "abc"` — must NOT return raw MCP `-32602`.

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: fulltext

### fulltext Group-Specific Testing

fulltext Tool Group (5 tools +1 for code mode):

1. 'mysql_fulltext_create'
2. 'mysql_fulltext_drop'
3. 'mysql_fulltext_search'
4. 'mysql_fulltext_boolean'
5. 'mysql_fulltext_expand'
6. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

**Test data:** Uses `test_articles` which has a FULLTEXT INDEX on `(title, body)`.

Searchable terms: `MySQL`, `database`, `JSON`, `FTS`, `MCP`, `API`, `search`, `replication`.

**Checklist:**

1. `mysql_fulltext_search({table: "test_articles", columns: ["title", "body"], query: "MySQL"})` → at least 1 result with relevance scores
2. `mysql_fulltext_search({table: "test_articles", columns: ["title", "body"], query: "nonexistent_word_xyz"})` → 0 results
3. `mysql_fulltext_boolean({table: "test_articles", columns: ["title", "body"], query: "+MySQL +database"})` → results containing both terms
4. `mysql_fulltext_boolean({table: "test_articles", columns: ["title", "body"], query: "+MySQL -JSON"})` → results with MySQL but not JSON
5. `mysql_fulltext_expand({table: "test_articles", columns: ["title", "body"], query: "database"})` → expanded results

**Domain error paths (🔴):**

6. 🔴 `mysql_fulltext_search({table: "nonexistent_xyz", columns: ["title"], query: "test"})` → `{success: false, error: "..."}` handler error
7. 🔴 `mysql_fulltext_search({table: "test_products", columns: ["name"], query: "test"})` → `{success: false, error: "..."}` (no FULLTEXT index)

**Zod validation error paths (🔴):**

8. 🔴 `mysql_fulltext_search({})` → `{success: false, error: "..."}` (missing required params)
9. 🔴 `mysql_fulltext_create({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

10. 🔴 `mysql_fulltext_search({table: "test_articles", columns: ["title", "body"], query: "MySQL", limit: "abc"})` → must NOT return raw MCP error

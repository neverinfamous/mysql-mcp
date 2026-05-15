# mysql-mcp Code Mode Re-Testing: [json]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

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
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                             | —                   |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations
3. Clean up any `temp_*` tables after testing
4. Report all failures, unexpected behaviors, or unnecessarily large payloads
5. **Scripting Efficiency**: Bundle multiple tool checks into a single `mysql_execute_code` call. Use conditional checks to aggregate errors and return a `failures` array.
6. **Pacing**: Test up to an entire tool group in a single script if feasible, but limit scripts to ~10-15 steps to remain manageable.

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type                 | What you see                                     | Verdict            |
| -------------------- | ------------------------------------------------ | ------------------ |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct            |
| **MCP error** ❌     | Raw error string, no `success` field             | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

## Cleanup Conventions

- **Temporary tables**: Prefix with `temp_`
- Your script should drop all `temp_*` objects at the end.

## Post-Test Procedures

1. **Cleanup**: Confirm all `temp_*` tables removed.
2. **Fix EVERY finding** — ❌ Fails, ⚠️ Issues, 📦 Payload.
3. **Read `../code-map.md` before making changes.**
4. Update the changelog if changes were made, commit without pushing.
5. Briefly summarize results with total token count prominently displayed.

---

## Group Focus: json

json Tool Group (17 tools +1 code mode):

1. `mysql_json_extract` 2. `mysql_json_set` 3. `mysql_json_insert` 4. `mysql_json_replace`
2. `mysql_json_remove` 6. `mysql_json_contains` 7. `mysql_json_keys` 8. `mysql_json_array_append`
3. `mysql_json_get` 10. `mysql_json_update` 11. `mysql_json_search` 12. `mysql_json_validate`
4. `mysql_json_merge` 14. `mysql_json_diff` 15. `mysql_json_normalize` 16. `mysql_json_stats`
5. `mysql_json_index_suggest`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.json.help()` → verify method listing
2. `mysql.json.extract({table: "test_json_docs", column: "doc", path: "$.author", where: "id = 1"})` → author name
3. `mysql.json.keys({table: "test_json_docs", column: "doc", where: "id = 1"})` → keys include `type`, `title`
4. `mysql.json.contains({table: "test_json_docs", column: "doc", contains: {type: "article"}, where: "id = 1"})` → true
5. `mysql.json.validate({value: '{"valid": true}'})` → `{valid: true}`
6. `mysql.json.validate({value: "{invalid"})` → `{valid: false}`
7. `mysql.json.stats({table: "test_json_docs", column: "doc"})` → verify `topKeys`
8. `mysql.json.diff({doc1: {a: 1, b: 2}, doc2: {a: 1, c: 3}})` → differences detected
9. `mysql.json.indexSuggest({table: "test_json_docs", column: "doc"})` → suggestions
10. `mysql.json.get({table: "test_json_docs", column: "doc", path: "$.title", where: "id = 1"})` → title value
11. `mysql.json.search({table: "test_json_docs", column: "doc", searchValue: "article"})` → matches
12. `mysql.json.merge({doc1: {a: 1}, doc2: {b: 2}})` → merged result
13. `mysql.json.normalize({table: "test_json_docs", column: "doc"})` → normalized output

**Domain error paths (🔴):**

14. 🔴 `mysql.json.extract({table: "nonexistent_xyz", column: "doc", path: "$.x"})` → `{success: false}`
15. 🔴 `mysql.json.extract({table: "test_json_docs", column: "nonexistent_col", path: "$.x"})` → `{success: false}`

**Zod validation error paths (🔴):**

16. 🔴 `mysql.json.keys({})` → `{success: false, error: "Validation error: ..."}`
17. 🔴 `mysql.json.extract({})` → `{success: false, error: "Validation error: ..."}`

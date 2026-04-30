# mysql-mcp Code Mode Re-Testing: [json]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

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

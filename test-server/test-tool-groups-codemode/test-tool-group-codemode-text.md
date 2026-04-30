# mysql-mcp Code Mode Re-Testing: [text]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

## Test Data: `test_users` (10 rows), `test_products` (16 rows)

---

## Group Focus: text

text Tool Group (6 tools +1 code mode):

1. `mysql_regexp_match` 2. `mysql_like_search` 3. `mysql_soundex`
2. `mysql_substring` 5. `mysql_concat` 6. `mysql_collation_convert`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.text.help()` → verify method listing
2. `mysql.text.regexpMatch({table: "test_users", column: "email", pattern: "^[a-z]"})` → matches
3. `mysql.text.likeSearch({table: "test_products", column: "name", pattern: "%Laptop%"})` → results
4. `mysql.text.soundex({table: "test_users", column: "username", value: "john"})` → phonetic matches
5. `mysql.text.substring({table: "test_users", column: "email", start: 1, length: 5})` → substrings
6. `mysql.text.concat({table: "test_users", columns: ["username", "email"], separator: " - "})` → concatenated

**Domain error paths (🔴):**

7. 🔴 `mysql.text.regexpMatch({table: "nonexistent_xyz", column: "x", pattern: "."})` → `{success: false}`
8. 🔴 `mysql.text.likeSearch({table: "test_users", column: "nonexistent_col", pattern: "%x%"})` → `{success: false}`

**Zod validation error paths (🔴):**

9. 🔴 `mysql.text.regexpMatch({})` → `{success: false, error: "Validation error: ..."}`
10. 🔴 `mysql.text.likeSearch({})` → `{success: false, error: "Validation error: ..."}`

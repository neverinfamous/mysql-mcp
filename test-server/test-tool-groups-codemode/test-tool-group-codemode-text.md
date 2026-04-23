# mysql-mcp Code Mode Re-Testing: [text]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Test Data: `test_users` (10 rows), `test_products` (16 rows)

## Requirements

1. **Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.
3. Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: text

text Tool Group (6 tools +1 code mode):

1. `mysql_regexp_match` 2. `mysql_like_search` 3. `mysql_soundex`
4. `mysql_substring` 5. `mysql_concat` 6. `mysql_collation_convert`

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

# mysql-mcp Code Mode Re-Testing: [fulltext]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Test Data: `test_articles` (10 rows, FULLTEXT on title+body)

## Requirements

1. **Coverage Matrix**: Track in `tmp/task.md`. Log Happy Path + Domain Error for EVERY tool.
2. Handler errors must return `{success: false, error: "..."}` — NOT raw MCP errors.
3. Post-Test: Fix findings, read `code-map.md`, update changelog, commit without pushing.

---

## Group Focus: fulltext

fulltext Tool Group (5 tools +1 code mode):

1. `mysql_fulltext_create` 2. `mysql_fulltext_drop` 3. `mysql_fulltext_search`
4. `mysql_fulltext_boolean` 5. `mysql_fulltext_expand`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.fulltext.help()` → verify method listing
2. `mysql.fulltext.search({table: "test_articles", columns: ["title", "body"], query: "MySQL"})` → results with relevance
3. `mysql.fulltext.search({table: "test_articles", columns: ["title", "body"], query: "nonexistent_word_xyz"})` → 0 results
4. `mysql.fulltext.boolean({table: "test_articles", columns: ["title", "body"], query: "+MySQL +database"})` → results
5. `mysql.fulltext.expand({table: "test_articles", columns: ["title", "body"], query: "database"})` → expanded results

**Domain error paths (🔴):**

6. 🔴 `mysql.fulltext.search({table: "nonexistent_xyz", columns: ["title"], query: "test"})` → `{success: false}`
7. 🔴 `mysql.fulltext.search({table: "test_products", columns: ["name"], query: "test"})` → `{success: false}` (no FTS index)

**Zod validation error paths (🔴):**

8. 🔴 `mysql.fulltext.search({})` → `{success: false, error: "Validation error: ..."}`
9. 🔴 `mysql.fulltext.create({})` → `{success: false, error: "Validation error: ..."}`

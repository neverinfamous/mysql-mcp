# mysql-mcp Code Mode Re-Testing: [fulltext]

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

---

## Group Focus: fulltext

fulltext Tool Group (5 tools +1 code mode):

1. `mysql_fulltext_create` 2. `mysql_fulltext_drop` 3. `mysql_fulltext_search`
2. `mysql_fulltext_boolean` 5. `mysql_fulltext_expand`

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

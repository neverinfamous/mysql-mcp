# mysql-mcp Tool Group Testing: [backup]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns |
|-------|------|-------------|
| `test_products` | 16 | id, name, price, category |
| `test_users` | 10 | id, username, email, phone, bio, role |

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: backup

### backup Group-Specific Testing

backup Tool Group (4 tools +1 for code mode):

1. 'mysql_export_table'
2. 'mysql_import_data'
3. 'mysql_create_dump'
4. 'mysql_restore_dump'
5. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_export_table({table: "test_products", limit: 5})` → verify 5 rows exported (SQL or CSV format)
2. `mysql_export_table({table: "test_products", format: "csv", limit: 3})` → verify CSV output
3. `mysql_create_dump({database: "testdb", tables: ["test_products"]})` → verify mysqldump command generated

**Domain error paths (🔴):**

4. 🔴 `mysql_export_table({table: "nonexistent_xyz"})` → `{success: false, error: "..."}` handler error (P154)

**Zod validation error paths (🔴):**

5. 🔴 `mysql_export_table({})` → `{success: false, error: "..."}` (Zod validation)
6. 🔴 `mysql_create_dump({})` → `{success: false, error: "..."}` (missing required params)

**Wrong-type numeric param coercion (🔴):**

7. 🔴 `mysql_export_table({table: "test_products", limit: "abc"})` → must NOT return raw MCP error

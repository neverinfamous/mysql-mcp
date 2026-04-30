# mysql-mcp Code Mode Re-Testing: [backup]

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

## Group Focus: backup

backup Tool Group (4 tools +1 code mode):

1. `mysql_export_table` 2. `mysql_import_data` 3. `mysql_create_dump` 4. `mysql_restore_dump`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.backup.help()` → verify method listing
2. `mysql.backup.exportTable({table: "test_products", limit: 5})` → 5 rows exported
3. `mysql.backup.exportTable({table: "test_products", format: "csv", limit: 3})` → CSV output
4. `mysql.backup.createDump({database: "testdb", tables: ["test_products"]})` → dump command

**Domain error paths (🔴):**

5. 🔴 `mysql.backup.exportTable({table: "nonexistent_xyz"})` → `{success: false}` (P154)

**Zod validation error paths (🔴):**

6. 🔴 `mysql.backup.exportTable({})` → `{success: false, error: "Validation error: ..."}`
7. 🔴 `mysql.backup.createDump({})` → `{success: false, error: "Validation error: ..."}`

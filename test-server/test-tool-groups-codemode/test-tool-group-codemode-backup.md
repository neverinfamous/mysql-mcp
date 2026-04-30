# mysql-mcp Code Mode Re-Testing: [backup]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

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

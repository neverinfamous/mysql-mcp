# mysql-mcp Code Mode Re-Testing: [migration]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: migration

migration Tool Group (6 tools +1 code mode):

1. `mysql_migration_init` 2. `mysql_migration_record` 3. `mysql_migration_apply`
4. `mysql_migration_rollback` 5. `mysql_migration_history` 6. `mysql_migration_status`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.migration.help()` → verify method listing
2. `mysql.migration.migrationInit()` → initialize tables
3. `mysql.migration.migrationRecord({version: "1.0.0", name: "initial", checksum: "123"})` → record
4. `mysql.migration.migrationApply({version: "1.0.1", name: "add_col", query: "ALTER TABLE test_users ADD COLUMN age INT"})` → apply
5. `mysql.migration.migrationStatus()` → check status
6. `mysql.migration.migrationHistory({limit: 5})` → get history
7. `mysql.migration.migrationRollback({version: "1.0.1"})` → rollback

**Domain error paths (🔴):**

8. 🔴 `mysql.migration.migrationRollback({version: "nonexistent_version"})` → `{success: false}`
9. 🔴 `mysql.migration.migrationApply({version: "1.0.1", name: "duplicate", query: "..."})` → `{success: false}`

**Zod validation error paths (🔴):**

10. 🔴 `mysql.migration.migrationRecord({})` → `{success: false, error: "Validation error: ..."}`
11. 🔴 `mysql.migration.migrationApply({})` → `{success: false, error: "Validation error: ..."}`

# mysql-mcp Tool Group Testing: [migration]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Do not put temp files in root; Use C:\Users\chris\Desktop\mysql-mcp\tmp

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|-------|------|-------------|--------------|
| `test_users` | 10 | id, username, email | — |

## Testing Requirements

1. **Error path testing**: For **every** tool, test (a) domain error and (b) Zod validation error (`{}`). Both must return `{success: false, error: "..."}`.
3. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- All tools accepting table names must return structured errors for nonexistent tables.
- Prefix temp tables with `temp_*`, drop after testing.
- After testing: fix findings, read `../code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: migration

### migration Group-Specific Testing

migration Tool Group (6 tools +1 for code mode):

1. 'mysql_migration_init'
2. 'mysql_migration_record'
3. 'mysql_migration_apply'
4. 'mysql_migration_rollback'
5. 'mysql_migration_history'
6. 'mysql_migration_status'
7. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_migration_init()` → verify table initialization
2. `mysql_migration_record({version: "1.0.0", name: "initial", checksum: "123"})` → verify migration recording
3. `mysql_migration_apply({version: "1.0.1", name: "add_col", query: "ALTER TABLE test_users ADD COLUMN age INT"})` → verify application
4. `mysql_migration_status()` → verify migration status
5. `mysql_migration_history({limit: 5})` → verify historical migrations
6. `mysql_migration_rollback({version: "1.0.1"})` → verify rollback functionality

**Domain error paths (🔴):**

7. 🔴 `mysql_migration_rollback({version: "nonexistent_version"})` → `{success: false, error: "..."}` handler error
8. 🔴 `mysql_migration_apply({version: "1.0.1", name: "duplicate", query: "..."})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

9. 🔴 `mysql_migration_record({})` → `{success: false, error: "..."}` (Zod validation)
10. 🔴 `mysql_migration_apply({})` → `{success: false, error: "..."}` (Zod validation)

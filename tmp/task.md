# sys Tool Group - Code Mode Coverage Matrix

| Tool | Happy Path | Domain Error Path | Status |
|---|---|---|---|
| `mysql.sys.help()` | ✅ Verified | N/A | ✅ PASS |
| `mysql.sys.userSummary()` | ✅ Verified | ✅ Verified (limit: -1 -> Zod validation error) | ✅ PASS |
| `mysql.sys.ioSummary()` | ✅ Verified | ✅ Verified (type: invalid -> Invalid type domain error) | ✅ PASS |
| `mysql.sys.statementSummary()` | ✅ Verified | ✅ Verified (orderBy: invalid -> Invalid orderBy domain error) | ✅ PASS |
| `mysql.sys.waitSummary()` | ✅ Verified | ✅ Verified (type: invalid -> Invalid type domain error) | ✅ PASS |
| `mysql.sys.innodbLockWaits()` | ✅ Verified | ✅ Verified (limit: -1 -> Zod validation error) | ✅ PASS |
| `mysql.sys.schemaStats()` | ✅ Verified | ✅ Verified (schema: non_existent -> Schema does not exist domain error) | ✅ PASS |
| `mysql.sys.hostSummary()` | ✅ Verified | ✅ Verified (limit: -1 -> Zod validation error) | ✅ PASS |
| `mysql.sys.memorySummary()` | ✅ Verified | ✅ Verified (limit: -1 -> Zod validation error) | ✅ PASS |

## Test Execution Details
- Executed via `mysql_execute_code` with structured try/catch blocks.
- All tools responded successfully to valid payloads (Happy Path).
- All domain errors returned `{success: false, error: "..."}` properly wrapped and NOT throwing raw MCP errors.
- Verified parameter input schemas (Zod) efficiently blocked invalid `limit` arguments on tools like `userSummary`, `hostSummary`, `memorySummary`, and `innodbLockWaits`.
- Validated `schemaStats` gracefully handles non-existent schemas without raw query exceptions.

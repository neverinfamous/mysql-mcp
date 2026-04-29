# Code Mode Test Coverage Matrix

## sys Group (mysql.sysschema / mysql.sys)

| Tool | Happy Path Tested | Domain Error Tested | Notes |
|---|---|---|---|
| mysql.sys.help() | ✅ Yes | N/A | Added `sys` as an alias for `sysschema` in `MysqlApi.ts` |
| mysql.sys.sysUserSummary() | ✅ Yes | ✅ Yes | Invalid user format (number) |
| mysql.sys.sysIoSummary() | ✅ Yes | ✅ Yes | Invalid type format (number) |
| mysql.sys.sysStatementSummary() | ✅ Yes | ✅ Yes | Invalid limit (negative) |
| mysql.sys.sysWaitSummary() | ✅ Yes | ✅ Yes | Invalid type format (number) |
| mysql.sys.sysInnodbLockWaits() | ✅ Yes | N/A | No parameters to test domain error |
| mysql.sys.sysSchemaStats() | ✅ Yes | ✅ Yes | Invalid schema format (number) |
| mysql.sys.sysHostSummary() | ✅ Yes | ✅ Yes | Invalid host format (number) |
| mysql.sys.sysMemorySummary() | ✅ Yes | N/A | No parameters to test domain error |

### Summary
- All handlers tested exclusively via Code Mode (`mysql_execute_code`).
- Handlers strictly adhere to the `{ success: false, error: ... }` format instead of throwing raw errors.
- Discovered that `mysql.sys` was undefined (only `mysql.sysschema` existed). Aliased `sys` to `sysschema` in `MysqlApi.ts`.

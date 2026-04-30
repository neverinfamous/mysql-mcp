# MySQL-MCP `sys` Tool Group Certification

## Coverage Matrix

| Tool | Description | Status | Error Details |
|---|---|---|---|
| mysql.sys.help | Verify method listing | ✅ Pass | |
| mysql.sys.userSummary - Happy | user resource usage | ✅ Pass | |
| mysql.sys.ioSummary - Happy | I/O metrics | ✅ Pass | |
| mysql.sys.statementSummary - Happy | statement analysis | ✅ Pass | |
| mysql.sys.waitSummary - Happy | wait events | ✅ Pass | |
| mysql.sys.innodbLockWaits - Happy | lock info | ✅ Pass | |
| mysql.sys.schemaStats - Happy | table/index sizes | ✅ Pass | |
| mysql.sys.schemaStats - Domain Error | table/index sizes (invalid schema) | ✅ Pass | |
| mysql.sys.hostSummary - Happy | host metrics | ✅ Pass | |
| mysql.sys.memorySummary - Happy | memory usage | ✅ Pass | |

## Summary
The `sys` tool group has been rigorously tested using `mysql_execute_code`.
1. All methods were executed effectively using Code Mode.
2. The missing aliases issue (e.g. `mysql.sys.userSummary` failing as "not a function") has been fixed by expanding `METHOD_ALIASES` in `constants.ts`.
3. Tested Domain Errors on schema operations and confirmed they returned the structured error `{ success: false, error: ... }` format.
4. Total failures: 0.

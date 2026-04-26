# Code Mode Strict Coverage Matrix: transactions

| Tool | Code Mode (Happy Path) | Code Mode (Domain Error) | Zod Validation Error |
|---|---|---|---|
| `mysql_transaction_begin` | ✅ | N/A | ✅ |
| `mysql_transaction_commit` | ✅ | ✅ | ✅ |
| `mysql_transaction_rollback` | ✅ | ✅ | ✅ |
| `mysql_transaction_savepoint` | ✅ | ✅ | ✅ |
| `mysql_transaction_release` | ✅ | ✅ | ✅ |
| `mysql_transaction_rollback_to` | ✅ | ✅ | ✅ |
| `mysql_transaction_execute` | ✅ | ✅ | ✅ |
| `mysql_execute_code` (codemode) | ✅ | ✅ | ✅ |

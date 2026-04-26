# Code Mode Strict Coverage Matrix: transactions

| Tool | Code Mode (Happy Path) | Code Mode (Domain Error) | Code Mode (Zod Validation) |
|---|---|---|---|
| `mysql_transaction_begin` | ✅ Pass | N/A | N/A |
| `mysql_transaction_commit` | ✅ Pass | ✅ Pass | N/A |
| `mysql_transaction_rollback` | N/A | ✅ Pass | N/A |
| `mysql_transaction_savepoint` | ✅ Pass | N/A | ✅ Pass |
| `mysql_transaction_release` | N/A | ✅ Pass | ✅ Pass |
| `mysql_transaction_rollback_to`| ✅ Pass | N/A | N/A |
| `mysql_transaction_execute` | ✅ Pass | N/A | ✅ Pass |

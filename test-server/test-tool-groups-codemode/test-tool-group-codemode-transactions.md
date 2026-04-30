# mysql-mcp Code Mode Re-Testing: [transactions]

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
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

## Test Database Schema

| Table | Rows | Key Columns |
|-------|------|-------------|
| `test_products` | 16 | id, name, price, category |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) |

## Testing Requirements

1. Use existing `test_*` tables for read operations
2. Create temporary tables with `temp_*` prefix for write operations; clean up after
4. **Scripting Efficiency**: Bundle checks into a single `mysql_execute_code` call with `failures` array.
5. **Deterministic checklist first**: Complete ALL items below before freeform exploration.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw error string, no `success` field | Bug |

## Post-Test: Fix findings, read `../code-map.md`, update changelog, commit without pushing.

---

## Group Focus: transactions

### transactions Group-Specific Testing

transactions Tool Group (7 tools +1 code mode):

1. 'mysql_transaction_begin'
2. 'mysql_transaction_commit'
3. 'mysql_transaction_rollback'
4. 'mysql_transaction_savepoint'
5. 'mysql_transaction_release'
6. 'mysql_transaction_rollback_to'
7. 'mysql_transaction_execute'
8. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Construct `mysql_execute_code` scripts to execute the checklist. Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.transactions.help()` → verify method listing
2. `mysql.transactions.begin()` → capture `transactionId`
3. `mysql.core.readQuery({query: "SELECT 1 AS test", transactionId: <id>})` → `{rows: [{test: 1}]}`
4. `mysql.transactions.savepoint({transactionId: <id>, name: "cm_sp1"})` → `success: true`
5. `mysql.transactions.rollbackTo({transactionId: <id>, name: "cm_sp1"})` → `success: true`
6. `mysql.transactions.commit({transactionId: <id>})` → `success: true`
7. `mysql.transactions.execute({statements: [{sql: "SELECT 1 AS a"}, {sql: "SELECT 2 AS b"}]})` → `statementsExecuted: 2`

**Domain error paths (🔴):**

8. 🔴 `mysql.transactions.commit({transactionId: "nonexistent-uuid"})` → `{success: false, error: "..."}`
9. 🔴 `mysql.transactions.rollback({transactionId: "nonexistent-uuid"})` → `{success: false, error: "..."}`

**Zod validation error paths (🔴):**

10. 🔴 `mysql.transactions.execute({})` → `{success: false, error: "..."}` (missing `statements`)
11. 🔴 `mysql.transactions.savepoint({})` → `{success: false, error: "..."}`

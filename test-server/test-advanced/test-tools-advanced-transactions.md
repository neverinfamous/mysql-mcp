# mysql-mcp Advanced Stress Tests: [transactions]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Pre-requisites

- Basic deterministic checklists in `../test-tool-groups/test-tool-group-transactions.md` MUST pass first.

## Post-Test: Drop all `stress_*` tables. Fix findings, update changelog, commit without pushing.

---

## Category 1: Rollback Recovery

1. Begin transaction, INSERT row, ROLLBACK — verify row does not exist
2. Begin transaction, INSERT row, SAVEPOINT, INSERT another, ROLLBACK TO SAVEPOINT — verify only first row exists after COMMIT
3. Begin transaction, COMMIT empty transaction — verify no error

## Category 2: Abandoned Transactions

4. Begin transaction — do NOT commit or rollback. Begin a new transaction — verify the first is auto-cleaned or returns structured error.
5. Begin transaction with explicit isolation level (READ COMMITTED) — verify it takes effect

## Category 3: Rapid State Transitions

6. Execute 5 sequential begin/commit cycles — verify no connection pool exhaustion
7. Execute transaction_execute with 10+ statements — verify all succeed

## Category 4: Mixed Statement Failures

8. Execute transaction_execute with mix of valid and invalid SQL — verify rollback occurs on failure
9. Execute transaction_execute with empty `statements: []` — verify structured error
10. Execute transaction_execute with duplicate insert (PK violation) in middle of batch — verify auto-rollback and structured error

## Cleanup

11. Verify no lingering transactions or temp tables

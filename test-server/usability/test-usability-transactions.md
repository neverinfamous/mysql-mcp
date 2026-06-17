# mysql-mcp Usability & Hallucination Test: Transactions

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `transactions` tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools in the `transactions` group:
`transaction_begin`, `transaction_commit`, `transaction_rollback`, `transaction_savepoint`, `transaction_release`, `transaction_rollback_to`, `transaction_execute`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Test method naming: The tools have `transaction_` prefixes (e.g. `mysql_transaction_commit`). Are they mapped intuitively? Try `mysql.transactions.commit()` instead of `mysql.transactions.transactionCommit()`.
- Test positional params: Try `mysql.transactions.commit("tx_id")` or `mysql.transactions.execute(["SELECT 1", "SELECT 2"])`.
- Test transaction execution wrapping: Test passing a single string instead of an array to `transaction_execute` to see if it is correctly coerced into an array by the wrapper.
- Test missing properties: Try passing `{}` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Apply the permanent fix to schemas, parameter mapping, or aliases.

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests pass cleanly.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize transactions tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

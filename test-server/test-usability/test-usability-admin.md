# mysql-mcp Usability & Hallucination Test: Admin

> **Note**: The default test database is `testdb`. If you need to specify a database explicitly in your API calls, use `testdb`.

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `admin` tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with tools in the `admin` group.

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: Pass `tableName` instead of `table`, `sql` instead of `query` to see if they resolve correctly.
- Test positional params: Try `mysql.admin.<method>("value")` if applicable.
- Test aliases: See if intuitively named methods work (e.g. `mysql.admin.get()`).
- Test missing properties: Try passing `{}` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Locate the appropriate file in the codebase (e.g., schemas, positional params, or aliases).
4. Apply the permanent fix.

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests and types pass locally.
3. You do NOT need to wait for a live server restart.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize admin tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

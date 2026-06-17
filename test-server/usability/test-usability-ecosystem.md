# mysql-mcp Usability & Hallucination Test: Ecosystem

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `cluster`, `router`, `proxysql`, `shell`, `sysschema`, and `vector` tool groups using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the key tools across these ecosystem groups. Because there are ~49 tools, focus on the most commonly hallucinated boundaries:

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Test method naming: Ensure `sys_` and `mysqlsh_` prefixes are intuitively mapped. Try `mysql.sysschema.users()` instead of `sysUserSummary()`. Try `mysql.shell.run()` instead of `runScript()`.
- Guess property names: Pass `sql` instead of `script`, or `tableName` instead of `table`.
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

1. If local verification passes, run `git add .` and `git commit -m "Optimize ecosystem tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

# mysql-mcp Usability & Hallucination Test: Admin & Monitoring

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `admin` and `monitoring` tool groups using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools across the two groups:
`optimize_table`, `analyze_table`, `check_table`, `repair_table`, `flush_tables`, `kill_query`, `append_insight`, `server_config`, `audit_search`, `show_processlist`, `show_status`, `show_variables`, `innodb_status`, `replication_status`, `pool_stats`, `server_health`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: For maintenance tools that accept `tables` (array), pass `tableName` or `table` as a string and verify it auto-coerces to a single-element array.
- Test method naming aliases: See if `mysql.admin.check("testdb")` works.
- Test missing properties: Try passing `{}` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Test type coercion: Try passing a string "10" to `limit` in `audit_search` to verify it gets coerced to a number.
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

1. If local verification passes, run `git add .` and `git commit -m "Optimize admin and monitoring tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

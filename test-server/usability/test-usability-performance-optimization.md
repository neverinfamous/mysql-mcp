# mysql-mcp Usability & Hallucination Test: Performance & Optimization

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `performance` and `optimization` tool groups using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools across the two groups:
`explain`, `explain_analyze`, `slow_queries`, `query_stats`, `index_usage`, `table_stats`, `buffer_pool_stats`, `thread_stats`, `detect_query_anomalies`, `detect_bloat_risk`, `detect_connection_spike`, `index_recommendation`, `query_rewrite`, `force_index`, `optimizer_trace`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: Pass `tableName` instead of `table`, `sql` instead of `query`.
- Test aliases: See if `mysql.performance.queryPlan` maps to `explain`, or `mysql.optimization.hint` maps to `force_index`.
- Test type coercion: If tools accept arrays (like `queries` in `index_recommendation`), pass a single string to verify the `z.preprocess()` auto-wraps it into an array instead of failing validation.
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

1. If local verification passes, run `git add .` and `git commit -m "Optimize performance and optimization tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

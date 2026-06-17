# mysql-mcp Usability & Hallucination Test: Core

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `core` tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools in the `core` group:
`read_query`, `write_query`, `list_tables`, `describe_table`, `create_table`, `drop_table`, `create_index`, `get_indexes`, `enable_versioning`, `disable_versioning`, `check_version`, `conditional_update`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: Pass `tableName` instead of `table`, `sql` instead of `query` to see if they resolve correctly.
- Test positional params: Try `mysql.core.readQuery("SELECT 1")` or `mysql.core.describeTable("test_products")`.
- Test aliases: See if `mysql.core.readQuery()` works when you try to call it intuitively.
- Test missing properties: Try passing `{}` to `read_query` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Test P154 (Object Existence): Query or describe a nonexistent table `nonexistent_table_xyz`. Verify it returns a clean `{ success: false, error: "..." }` domain error, not a raw MySQL wire protocol exception.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Locate the appropriate file in the codebase (e.g., schemas in `src/adapters/mysql/schemas/core.ts`, positional params in `src/codemode/api/constants/positional.ts`, or aliases in `src/codemode/api/constants/aliases.ts`).
4. Apply the permanent fix.

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests and types pass locally.
3. You do NOT need to wait for a live server restart.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize core tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

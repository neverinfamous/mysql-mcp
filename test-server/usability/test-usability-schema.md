# mysql-mcp Usability & Hallucination Test: Schema

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `schema` tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

Use the `mysql_execute_code` tool to interact with the following tools in the `schema` group:
`list_schemas`, `create_schema`, `drop_schema`, `list_views`, `create_view`, `drop_view`, `list_stored_procedures`, `list_functions`, `list_triggers`, `list_constraints`, `list_events`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: Pass `tableName` instead of `table`, `db` instead of `database`.
- Test positional params: Try `mysql.schema.listViews("testdb")` or `mysql.schema.dropSchema("temp_schema")`.
- Test intuitive method naming: Try calling `mysql.schema.views()` or `mysql.schema.triggers()` or `mysql.schema.createDb()`. If they fail, add them as aliases.
- Test missing properties: Try passing `{}` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Test P154 (Object Existence): Query a nonexistent database or view. Verify it returns a clean domain error, not a raw MySQL wire protocol exception.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Apply the permanent fix to schemas, parameter mapping, or aliases.

## 3. Local Verification

1. Run `pnpm run check`, `pnpm run build`, `pnpm run test` and `pnpm run test:e2e` locally.
2. **DO NOT PROCEED** until all tests and types pass locally.
3. You do NOT need to wait for a live server restart.

## 4. Commit

1. If local verification passes, run `git add .` and `git commit -m "Optimize schema tool usage"`.
2. Report your findings to the Coordinator.

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

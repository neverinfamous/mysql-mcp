# mysql-mcp Usability & Hallucination Test: Shell (Part 4)

> **This test is optimized for an autonomous agent.**

This prompt instructs you to organically test the `shell` tool group using Code Mode (`mysql_execute_code`), intentionally fuzzing the inputs to discover agent hallucinations, and permanently hardening the codebase against them.

## 1. Fuzz Phase

> ⚠️ **CRITICAL ECOSYSTEM REQUIREMENT**: The `shell` tools run on a different MCP config. You MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for `mysql_execute_code`). If you target the standard `mysql` server, you will improperly test graceful degradation instead of actively testing the live ecosystem server.

Use the `mysql_execute_code` tool to interact with the following tools in the `shell` group:
- `mysqlsh_run_script`

**Instructions:**

- Do not perfectly structure your initial calls. Act intuitively as an agent.
- Guess property names: Pass `tableName` instead of `table`, `sql` instead of `query` to see if they resolve correctly.
- Test positional params: Try `mysql.shell.<method>("value")` if applicable.
- Test aliases: See if intuitively named methods work (e.g. `mysql.shell.get()`).
- Test type coercions: Try passing strings for number fields like `timeout: "1000"` to verify coercion works.
- Test missing properties: Try passing `{}` to verify it throws a structured domain error (e.g., `VALIDATION_ERROR`) instead of a raw Zod/MCP exception.
- Note any errors, exceptions, or unexpected behavior.

## 2. Heal Phase

If you encounter any failures, errors, or hallucinations:

1. STOP. Do not just work around the issue in your script.
2. Read the hardening guidelines in `skills/mysql-mcp-heal/SKILL.md`.
3. Locate the appropriate file in the codebase (e.g., schemas, positional params, or aliases).
4. Apply the permanent fix.

## 3. Local Verification

1. Run `pnpm run lint` and `pnpm run typecheck` locally.
2. **DO NOT PROCEED** until linting and typechecking pass locally.
3. You do NOT need to wait for a live server restart.

## 4. Commit & Report

1. **ONLY if you made modifications** (code or prompt):
   - Run `git add .` and `bun .\.agents\scripts\commit.ts --msg "test(usability): Optimize shell tool usage" --impact 0.1 --confidence 1.0 --validation passed --journal --add .`.
   - Create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt.
2. Report your findings to the Coordinator.
3. **CRITICAL**: You MUST format your final result summary with the exact number of fixes applied at the very top:
   - **`X fixes applied [Y Prompt / Z Code]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code]`**) in bold.
   - You MUST also include an explicit status line: `STATUS: SUCCESS`

## 5. Continuous Improvement

If during this test you discover a blind spot or a new hallucination vector, edit this markdown file directly to permanently improve the testing apparatus. Commit any prompt improvements alongside your codebase fixes.

# MySQL MCP Direct Usability Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Validates the agent interaction experience with **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` usability test suite using subagents.

## Goal

Execute usability tests in `test-server/test-usability-direct/`. Fuzz tools to trigger agent hallucinations. Harden the codebase using the `/mcp:mysql-mcp:mysql_mcp_heal` prompt.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). The server schemas, proxy logic, and `server-instructions` are central files, and parallel mutation will cause git conflicts and require overlapping local CI runs.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Use the exact `<subagent_prompt>` template defined in the Phase file as the subagent's prompt. Do NOT use the path alone or improvise instructions.
3. **Local Verification (NO PAUSING)**:
   - If you or a subagent modifies the codebase, the subagent MUST validate all changes locally by running ONLY `pnpm run lint` and `pnpm run typecheck`. Do NOT run `pnpm run test` or `pnpm run check` during the intermediate steps to prevent context window exhaustion. Ensure the checks pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - **Quality Gates**: Pay strict attention to ESLint and TypeScript compiler outputs. You MUST fix all lint and typecheck validation issues prior to committing. Do NOT ignore warnings or errors. Follow strict TypeScript guidelines: NEVER use `any` (use `unknown` with type guards), avoid unsafe typecasts, and ensure explicit return types.
   - **WARNING**: Do NOT commit your code and then attempt to use `git commit --amend` to fix a lingering lint or test issue later. Amending a commit rewrites the commit SHA, which will permanently break the changelog tracking workflow.
   - DO NOT perform live server verification unless required after a code fix. If you must verify a fix, you MUST pause and ask the user to manually click the "Refresh" button in the IDE UI to restart the server. DO NOT attempt to run any restart scripts (e.g. `restart-mcp.ts`) as they will not work.
   - If a subagent edits any `server-instructions/*.md` files, they MUST run `pnpm run generate:instructions` before building.
4. **Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - Once all local tests pass, the subagent will commit their changes (`bun .\.agents\scripts\commit.ts --msg "test(usability): Optimize [group] tool usage" --impact 0.1 --confidence 1.0 --validation passed --journal --add .`) and create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made modifications (code or prompt), summarize findings, and exit. If no modifications were needed, no commit or journal entry is required.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered infrastructure absence.
   - **CRITICAL**: Our setup provides everything for all testing to be successful. There should never be any infrastructure absences. If the subagent thinks it is only testing infrastructure absence due to a temporary problem in a tool, group of tools, or the entire ecosystem setup, it MUST explicitly inform the user and log it as a infrastructure absence. **NOTE: "Infrastructure Absent" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error to ensure it is handled gracefully). SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS INFRASTRUCTURE ABSENT.**
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
   - Once the subagent completes, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and move to the next test in the queue.
5. **Domain Error Testing Protocol**:
   - Subagents executing test matrices must anticipate structured `VALIDATION_ERROR` or other domain error payloads with `{ success: false }` for type mismatches, rather than expecting thrown raw exceptions.
6. **Tool Availability Warning**:
   - If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server. (Note: MySQL Shell tools MUST target the standard `mysql` server due to X Protocol port mapping restrictions). If the subagent targets the standard `mysql` server, it will improperly test infrastructure absence instead of actively testing the live cluster, which is a FAILURE of the test.
7. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "Test X (<test name>) out of Y: A Prompt Fixes / B Code Fixes / C Infrastructure Absent" (e.g., "Test 32 (Spatial queries part 1) out of 77: 1 Prompt Fixes / 0 Code Fixes / 0 Infrastructure Absent")
   - The Coordinator MUST explicitly tell the user after each test exactly how many prompt fixes were made, code fixes were made, and infrastructure absences were experienced (there should not be any).
   - Do NOT output any other text to the user during the test sequence. Do not wrap the message in quotes or add preamble.
8. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-usability-direct/` BEFORE starting, and cross-reference the actual directory contents against the queues inside the Phase files and `test-server/scripts/test-manifest.ts`. The definitive generation logic is in `test-server/scripts/generate-tests.ts`.
   - The Coordinator MUST explicitly create a checklist (e.g., using a `task.md` artifact) copying the exact Test Sequence Queue to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or this file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.

## Test Sequence Queue

> [!WARNING]
> **ANTI-EXHAUSTION ARCHITECTURE**
> Do NOT execute these tests in a single thread. The 127 tests have been sharded into 4 phases to prevent LLM context window exhaustion.
>
> **How to run:**
>
> 1. Start a NEW thread for Phase 1 and pass the agent the `coordinator-workflow-phase1-foundation.md` file.
> 2. When Phase 1 completes, start a NEW thread for Phase 2, etc.

### Execution Phases:

- [Phase 1: Foundation (Core, JSON, Text)](coordinator-workflow-phase1-foundation.md)
- [Phase 2: Admin & Performance](coordinator-workflow-phase2-admin.md)
- [Phase 3: Schema & Stats](coordinator-workflow-phase3-schema.md)
- [Phase 4: Analytics & Advanced](coordinator-workflow-phase4-analytics.md)

## Post-Suite Validation

When all subagents have completed their testing, the main coordinator agent MUST execute the following steps:

1. Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e` and fix any problems. Do NOT leave the test suite in a broken state.
2. Confirm any scratch files created against instructions are removed and cleaned from git history if needed.
3. Confirm that all non-scratch files are properly committed.
4. Message the user: "The test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

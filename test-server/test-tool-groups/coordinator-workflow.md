# MySQL MCP Tool Groups Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Coordinates execution across 242 tools to ensure robustness of **OAuth 2.1**, **Direct Tool Calls**, and **Connection Pooling**.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Tool Groups test suite using subagents.

## Goal

Systematically execute all standard tool group tests in `test-server/test-tool-groups/` to verify behavioral correctness, parameter validation, error handling, and output schemas. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

## Workflow Rules

1. **Batched Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). Because the `mysql-mcp` server uses a Tool Filter (shortcuts) to prevent exceeding IDE limits, the tests are grouped into multiple **Phases** based on the required shortcut.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file within the current Phase.
   - Use the exact `<subagent_prompt>` template defined in the Phase file as the subagent's prompt. Do NOT use the path alone or improvise instructions.
3. **Phase Transitions & Server Restarts**:
   - The Coordinator will run continuously _within_ each Phase.
   - When a Phase is complete, the Coordinator MUST instruct the user to start a NEW thread for the next phase. DO NOT continue in the same thread.
4. **Validation and Immediate Continuation (Within a Phase)**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint` and `pnpm run typecheck`. The subagent MUST NOT run `pnpm run test`, `pnpm run build`, or `pnpm run check` or any other tests, as this takes too long (15-20 minutes). The subagent MUST PAUSE and ask the user to manually click the "Refresh" button in the IDE UI to restart the server. DO NOT attempt to run any scripts like `restart-mcp.ts` as they will not work. Ensure the local checks pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the restart script and immediately report back to the Coordinator.
5. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST commit all changes locally (`bun .\.agents\scripts\commit.ts --msg "test(tool-groups): ..." --impact 0.1 --confidence 1.0 --validation passed --journal --add .`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the current Phase.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered infrastructure absence.
   - **CRITICAL**: Our setup provides everything for all testing to be successful. There should never be any infrastructure absences. If the subagent thinks it is only testing infrastructure absence due to a temporary problem in a tool, group of tools, or the entire ecosystem setup, it MUST explicitly inform the user and log it as a infrastructure absence. **NOTE: "Infrastructure Absent" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error to ensure it is handled gracefully). SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS INFRASTRUCTURE ABSENT.**
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
6. **Structured Error Handling**:
   - Ensure subagents explicitly check that tools return structured MCP errors, not raw exceptions. Error messages should follow the standard `[LEVEL] [module] [CODE] message (context)` format where applicable.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router, shell) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for tool calls like `mysql_cluster_status`). If the subagent targets the standard `mysql` server, it will improperly test infrastructure absence instead of actively testing the live cluster, which is a FAILURE of the test.
7. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "Test X (<test name>) out of Y: A Prompt Fixes / B Code Fixes / C Infrastructure Absent" (e.g., "Test 32 (Spatial queries part 1) out of 77: 1 Prompt Fixes / 0 Code Fixes / 0 Infrastructure Absent")
   - The Coordinator MUST explicitly tell the user after each test exactly how many prompt fixes were made, code fixes were made, and infrastructure absences were experienced (there should not be any).
   - The Coordinator is allowed to output additional information and custom messages _only_ during phase transitions. Do not wrap the message in quotes or add preamble.
8. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-tool-groups/` BEFORE starting, and cross-reference the actual directory contents against the list in the current phase file.
   - The Coordinator MUST explicitly create a checklist (e.g., using a `task.md` artifact) copying the exact Test Sequence Queue from the current phase file to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or the current phase file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.
   - **CRITICAL**: When updating the `task.md` checklist via tools like `replace_file_content`, you MUST ONLY change the status brackets (e.g., changing `[ ]` to `[ ]` or `[ ]`). DO NOT accidentally rewrite, abbreviate, or guess the filenames of upcoming tests. Doing so will cause them to fail with `FAILED_FILE_NOT_FOUND`.

## Test Sequence Queue (Dependency DAG)

> [!WARNING]
> **ANTI-EXHAUSTION ARCHITECTURE**
> Do NOT execute these tests in a single thread. The tests have been sharded into 11 phases to prevent LLM context window exhaustion.
>
> **How to run:**
>
> 1. Start the server with the shortcut for Phase 1.
> 2. Start a NEW thread for Phase 1 and pass the agent the `coordinator-workflow-phase1-starter.md` file.
> 3. When Phase 1 completes, update the shortcut, restart the server, and start a NEW thread for Phase 2, etc.

### Execution Phases:

- [Phase 1 (starter)](coordinator-workflow-phase1-starter.md)
- [Phase 2 (dev-power)](coordinator-workflow-phase2-dev-power.md)
- [Phase 3 (dev-analytics)](coordinator-workflow-phase3-dev-analytics.md)
- [Phase 4 (ai-data-nosql)](coordinator-workflow-phase4-ai-data-nosql.md)
- [Phase 5 (ai-search)](coordinator-workflow-phase5-ai-search.md)
- [Phase 6 (ai-spatial)](coordinator-workflow-phase6-ai-spatial.md)
- [Phase 7 (dba-monitor)](coordinator-workflow-phase7-dba-monitor.md)
- [Phase 8 (dba-manage)](coordinator-workflow-phase8-dba-manage.md)
- [Phase 9 (dba-secure)](coordinator-workflow-phase9-dba-secure.md)
- [Phase 10 (dba-schema)](coordinator-workflow-phase10-dba-schema.md)
- [Phase 11 (ecosystem)](coordinator-workflow-phase11-ecosystem.md)

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `mysql://metrics`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

When all subagents have completed their testing, the main coordinator agent MUST execute the following steps:

1. Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test:vitest`, and `pnpm run test:e2e` and fix any problems. Do NOT leave the test suite in a broken state.
2. Confirm any scratch files created against instructions are removed and cleaned from git history if needed.
3. Confirm that all non-scratch files are properly committed.
4. Message the user: "The test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

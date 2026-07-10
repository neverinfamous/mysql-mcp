# MySQL MCP Tool Groups Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Coordinates execution across 242 tools to ensure robustness of **OAuth 2.1**, **Direct Tool Calls**, and **Connection Pooling**.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

We're working in the `mysql-mcp` project in this thread.

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Tool Groups test suite using subagents.

## Goal

Systematically execute all standard tool group tests in `test-server/test-tool-groups/` to verify behavioral correctness, parameter validation, error handling, and output schemas. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

## Workflow Rules

1. **Batched Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). Because the `mysql-mcp` server uses a Tool Filter (shortcuts) to prevent exceeding IDE limits, the tests are grouped into multiple **Phases** based on the required shortcut.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file within the current Phase.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Phase Transitions & Server Restarts**:
   - The Coordinator will run continuously _within_ each Phase.
   - When a Phase is complete, the Coordinator MUST pause and message the user: _"Phase X complete. Please switch the main config shortcut to `[Next Shortcut]` and manually restart the `mysql-mcp` server. Reply 'ready' when done."_
   - Do NOT proceed to the next Phase until the user replies 'ready'.
4. **Validation and Immediate Continuation (Within a Phase)**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build` and targeted tests for the changes they made (or just the tests for that tool group, not the entire suite). If that's not practical, they should only run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build`. Ensure the local checks and relevant tests pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation and immediately report back to the Coordinator.
5. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`bun .\.agents\scripts\commit.ts --msg "test(tool-groups): ..." --impact 0.1 --confidence 1.0 --validation passed --journal --add .`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the current Phase.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered graceful degradation. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied [Y Prompt / Z Code] [W Graceful Fails]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code] [0 Graceful Fails]`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - **CRITICAL**: Our setup provides everything for all testing to be successful. There should never be any graceful fails. If the subagent thinks it is only testing graceful degradation due to a temporary problem in a tool, group of tools, or the entire ecosystem setup, it MUST explicitly inform the user and log it as a graceful fail. **NOTE: "Graceful Fails" refers to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error to ensure it is handled gracefully). Successful negative tests should NOT be counted as Graceful Fails.**
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
6. **Structured Error Handling**:
   - Ensure subagents explicitly check that tools return structured MCP errors, not raw exceptions. Error messages should follow the standard `[LEVEL] [module] [CODE] message (context)` format where applicable.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router, shell) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for tool calls like `mysql_cluster_status`). If the subagent targets the standard `mysql` server, it will improperly test graceful degradation instead of actively testing the live cluster, which is a FAILURE of the test.
7. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "Test X out of Y. Z fixes applied [A Prompt / B Code] [C Graceful Fails]: <concise description>." (e.g., "Test 32 out of 77. 1 fixes applied [1 Prompt / 0 Code] [0 Graceful Fails]: fixed typo in prompt.")
   - The Coordinator MUST explicitly tell the user after each test exactly how many prompt fixes were made, code fixes were made, and graceful degradations were experienced (there should not be any).
   - The Coordinator is allowed to output additional information and custom messages *only* during phase transitions. Do not wrap the message in quotes or add preamble.
8. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-tool-groups/` BEFORE starting, and cross-reference the actual directory contents against the list below.
   - The Coordinator MUST explicitly create a checklist (e.g., using a `task.md` artifact) copying the exact Test Sequence Queue to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or this file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.
   - **CRITICAL**: When updating the `task.md` checklist via tools like `replace_file_content`, you MUST ONLY change the status brackets (e.g., changing `[ ]` to `[/]` or `[x]`). DO NOT accidentally rewrite, abbreviate, or guess the filenames of upcoming tests. Doing so will cause them to fail with `FAILED_FILE_NOT_FOUND`.

## Test Sequence Queue (Dependency DAG)

### Phase 1: `starter` shortcut

- `test-core-part1.md` (**MUST PASS FIRST**)
- `test-core-part2.md`
- `test-core-part3.md`
- `test-core-part4.md`
- `test-codemode.md`
- `test-json-core-part1.md`
- `test-json-core-part2.md`
- `test-json-core-part3.md`
- `test-json-enhanced-part1.md`
- `test-json-enhanced-part2.md`
- `test-json-helpers-part1.md`
- `test-json-helpers-part2.md`
- `test-transactions-part1.md`
- `test-transactions-part2.md`
- `test-transactions-part3.md`
- `test-text-part1.md`
- `test-text-part2.md`

_(Coordinator pauses: Asks user to switch filter to `dev-power` and restart)_

### Phase 2: `dev-power` shortcut

- `test-schema-management-part1.md`
- `test-schema-management-part2.md`
- `test-schema-management-part3.md`
- `test-schema-routines-part1.md`
- `test-schema-routines-part2.md`
- `test-performance-analysis-part1.md`
- `test-performance-analysis-part2.md`
- `test-performance-analysis-part3.md`
- `test-performance-anomaly.md`
- `test-fulltext-part1.md`
- `test-fulltext-part2.md`

_(Coordinator pauses: Asks user to switch filter to `dev-analytics` and restart)_

### Phase 3: `dev-analytics` shortcut

- `test-stats-advanced-part1.md`
- `test-stats-advanced-part2.md`
- `test-stats-descriptive-part1.md`
- `test-stats-descriptive-part2.md`
- `test-stats-descriptive-part3.md`
- `test-stats-window-part1.md`
- `test-stats-window-part2.md`

_(Coordinator pauses: Asks user to switch filter to `ai-data-nosql` and restart)_

### Phase 4: `ai-data-nosql` shortcut

- `test-docstore-part1.md`
- `test-docstore-part2.md`
- `test-docstore-part3.md`

_(Coordinator pauses: Asks user to switch filter to `ai-search` and restart)_

### Phase 5: `ai-search` shortcut

- `test-vector-management-part1.md`
- `test-vector-management-part2.md`
- `test-vector-search.md`
- `test-vector-storage-part1.md`
- `test-vector-storage-part2.md`

_(Coordinator pauses: Asks user to switch filter to `ai-spatial` and restart)_

### Phase 6: `ai-spatial` shortcut

- `test-spatial-geometry.md`
- `test-spatial-operations-part1.md`
- `test-spatial-operations-part2.md`
- `test-spatial-queries-part1.md`
- `test-spatial-queries-part2.md`
- `test-spatial-setup.md`

_(Coordinator pauses: Asks user to switch filter to `dba-monitor` and restart)_

### Phase 7: `dba-monitor` shortcut

- `test-monitoring-part1.md`
- `test-monitoring-part2.md`
- `test-monitoring-part3.md`
- `test-sys-part1.md`
- `test-sys-part2.md`
- `test-sys-part3.md`
- `test-optimization-part1.md`
- `test-optimization-part2.md`

_(Coordinator pauses: Asks user to switch filter to `dba-manage` and restart)_

### Phase 8: `dba-manage` shortcut

- `test-admin-part1.md`
- `test-admin-part2.md`
- `test-admin-part3.md`
- `test-backup-part1.md`
- `test-backup-part2.md`
- `test-backup-part3.md`
- `test-replication-part1.md`
- `test-replication-part2.md`
- `test-partitioning-part1.md`
- `test-partitioning-part2.md`
- `test-events-part1.md`
- `test-events-part2.md`

_(Coordinator pauses: Asks user to switch filter to `dba-secure` and restart)_

### Phase 9: `dba-secure` shortcut

- `test-security-part1.md`
- `test-security-part2.md`
- `test-security-part3.md`
- `test-roles-part1.md`
- `test-roles-part2.md`
- `test-roles-part3.md`

_(Coordinator pauses: Asks user to switch filter to `dba-schema` and restart)_

### Phase 10: `dba-schema` shortcut

- `test-introspection-part1.md`
- `test-introspection-part2.md`
- `test-migration-part1.md`
- `test-migration-part2.md`

_(Coordinator pauses: Asks user to switch testing to the mysql-ecosystem server)_

### Phase 11: `ecosystem` shortcut

- `test-cluster-gr.md`
- `test-cluster-innodb-part1.md`
- `test-cluster-innodb-part2.md`
- `test-cluster-innodb-part3.md`
- `test-proxysql-part1.md`
- `test-proxysql-part2.md`
- `test-proxysql-part3.md`
- `test-proxysql-part4.md`
- `test-router-part1.md`
- `test-router-part2.md`
- `test-router-part3.md`
- `test-shell-part1.md`
- `test-shell-part2.md`
- `test-shell-part3.md`
- `test-shell-part4.md`

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `mysql://metrics`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

When all subagents have completed their testing, the main coordinator agent MUST execute the following steps:

1. Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test:vitest`, and `pnpm run test:e2e` and fix any problems. Do NOT leave the test suite in a broken state.
2. Confirm any scratch files created against instructions are removed and cleaned from git history if needed.
3. Confirm that all non-scratch files are properly committed.
4. Message the user: "The test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

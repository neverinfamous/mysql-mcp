# MySQL MCP Advanced Code Mode Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Orchestrates deep validation of our advanced capabilities: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

We're working in the `mysql-mcp` project in this thread.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Advanced Code Mode test suite using subagents.

## Goal

Execute all tests in `test-server/test-advanced/`. Verify sandbox isolation, workflow orchestration, payload optimization, and error handling. Delegate testing to subagents for high-fidelity results. Compile telemetry during execution.



## Workflow Rules

1. **Sequential Execution**: Execute tests sequentially per the Dependency DAG below to prevent server conflicts.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint`, `pnpm run typecheck`, and only the relevant `vitest` and `playwright` tests (do NOT run the entire test suites). Ensure the local checks and relevant tests pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
# MySQL MCP Advanced Code Mode Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Orchestrates deep validation of our advanced capabilities: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

We're working in the `mysql-mcp` project in this thread.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Advanced Code Mode test suite using subagents.

## Goal

Execute all tests in `test-server/test-advanced/`. Verify sandbox isolation, workflow orchestration, payload optimization, and error handling. Delegate testing to subagents for high-fidelity results. Compile telemetry during execution.



## Workflow Rules

1. **Sequential Execution**: Execute tests sequentially per the Dependency DAG below to prevent server conflicts.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build` and targeted tests for the changes they made (or just the tests for that tool group, not the entire suite). If that's not practical, they should only run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build`. Ensure the local checks and relevant tests pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`bun .\.agents\scripts\commit.ts --msg "test(advanced): ..." --impact 0.1 --confidence 1.0 --validation passed --journal --add .`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered graceful degradation. Instruct the subagent to ALWAYS format this string exactly as **`Y Prompt / Z Code / W Graceful Fails`** (e.g., **`0 Prompt / 0 Code / 0 Graceful Fails`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - **CRITICAL**: Our setup provides everything for all testing to be successful. There should never be any graceful fails. If the subagent thinks it is only testing graceful degradation due to a temporary problem in a tool, group of tools, or the entire ecosystem setup, it MUST explicitly inform the user and log it as a graceful fail. **NOTE: "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error to ensure it is handled gracefully). SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.**
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
5. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "Test X (<test name>) out of Y: A Prompt / B Code / C Graceful Fails" (e.g., "Test 32 (Spatial queries part 1) out of 77: 1 Prompt / 0 Code / 0 Graceful Fails")
   - The Coordinator MUST explicitly tell the user after each test exactly how many prompt fixes were made, code fixes were made, and graceful degradations were experienced (there should not be any).
   - Do NOT output any other text to the user during the test sequence. Do not wrap the message in quotes or add preamble.

1. `test-codemode-advanced-admin-control-part1.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-admin-control-part2.md`
3. `test-codemode-advanced-admin-maintenance-part1.md`
4. `test-codemode-advanced-admin-maintenance-part2.md`
5. `test-codemode-advanced-backup-audit-part1.md`
6. `test-codemode-advanced-backup-audit-part2.md`
7. `test-codemode-advanced-backup-export-part1.md`
8. `test-codemode-advanced-backup-export-part2.md`
9. `test-codemode-advanced-cluster-group-replication-part1.md`
10. `test-codemode-advanced-cluster-group-replication-part2.md`
11. `test-codemode-advanced-cluster-innodb-part1.md`
12. `test-codemode-advanced-cluster-innodb-part2.md`
13. `test-codemode-advanced-concurrency.md`
14. `test-codemode-advanced-core-part1a.md`
15. `test-codemode-advanced-core-part1b.md`
16. `test-codemode-advanced-core-part2a.md`
17. `test-codemode-advanced-core-part3a.md`
18. `test-codemode-advanced-core-part3b.md`
19. `test-codemode-advanced-docstore-collections-part1.md`
20. `test-codemode-advanced-docstore-collections-part2.md`
21. `test-codemode-advanced-docstore-documents-part1.md`
22. `test-codemode-advanced-docstore-documents-part2.md`
23. `test-codemode-advanced-events-part1.md`
24. `test-codemode-advanced-events-part2.md`
25. `test-codemode-advanced-fulltext-part1.md`
26. `test-codemode-advanced-fulltext-part2.md`
27. `test-codemode-advanced-introspection-part1.md`
28. `test-codemode-advanced-introspection-part2.md`

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `mysql://metrics`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

When all subagents have completed their testing, the main coordinator agent MUST execute the following steps:

1. Run `pnpm run lint`, `pnpm run typecheck`, `pnpm run build`, `pnpm run test`, and `pnpm run test:e2e` and fix any problems. Do NOT leave the test suite in a broken state.
2. Confirm any scratch files created against instructions are removed and cleaned from git history if needed.
3. Confirm that all non-scratch files are properly committed.
4. Message the user: "The test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

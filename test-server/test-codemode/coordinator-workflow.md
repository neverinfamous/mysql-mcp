# MySQL MCP Code Mode Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Orchestrates deep validation of our advanced capabilities: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

We're working in the `mysql-mcp` project in this thread.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on running the Code Mode test suite.

## Goal

Execute all tests in `test-server/test-codemode/`. Verify sandbox isolation, workflow orchestration, payload optimization, and error handling. Delegate testing to subagents for high-fidelity results. Compile telemetry during execution.

## Workflow Rules

1. **Sequential Execution**: Execute tests sequentially per the Dependency DAG below to prevent server conflicts.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint`, `pnpm run typecheck`, and only the relevant `vitest` and `playwright` tests (do NOT run the entire test suites). Ensure the local checks and relevant tests pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`bun .\.agents\scripts\commit.ts --msg "test(codemode): ..." --impact 0.1 --confidence 1.0 --validation passed --journal --add .`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered graceful degradation. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied [Y Prompt / Z Code] [W Graceful Fails]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code] [0 Graceful Fails]`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - **CRITICAL**: Our setup provides everything for all testing to be successful. There should never be any graceful fails. If the subagent thinks it is only testing graceful degradation due to a temporary problem in a tool, group of tools, or the entire ecosystem setup, it MUST explicitly inform the user and log it as a graceful fail. **NOTE: "Graceful Fails" refers to tests that could NOT be completed due to a temporary system problem or tool limitation. It does NOT refer to successful negative tests (e.g., intentionally triggering a validation error to ensure it is handled gracefully). Successful negative tests should NOT be counted as Graceful Fails.**
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
   - Ensure subagents explicitly check that Code Mode scripts do NOT leak raw MCP exceptions, returning `{ success: false }` for domain errors.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router, shell) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for tool calls like `mysql_execute_code`). If the subagent targets the standard `mysql` server, it will improperly test graceful degradation instead of actively testing the live cluster, which is a FAILURE of the test.
5. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: This is test X out of Y. X fixes applied [Y Prompt / Z Code] [W Graceful Fails]: <concise description>. (e.g., This is test 40 out of 76. 1 fixes applied [1 Prompt / 0 Code] [0 Graceful Fails]: fixed typo in prompt.)
   - The Coordinator MUST explicitly tell the user after each test exactly how many prompt fixes were made, code fixes were made, and graceful degradations were experienced.
   - Do NOT output any other text to the user during the test sequence. Do not wrap the message in quotes or add preamble.
6. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-codemode/` BEFORE starting, and cross-reference the actual directory contents against the list below.
   - The Coordinator MUST explicitly create a checklist in `<appDataDir>\brain\<conversation-id>\task.md` copying the exact Test Sequence Queue to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or this file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.

## Test Sequence Queue (Dependency DAG)

1. `test-codemode-core-read.md` (**MUST PASS FIRST**)
2. `test-codemode-admin-audit.md`
3. `test-codemode-admin-maintenance-part1.md`
4. `test-codemode-admin-maintenance-part2.md`
5. `test-codemode-backup-audit.md`
6. `test-codemode-backup-data.md`
7. `test-codemode-cluster-group-replication-part1.md`
8. `test-codemode-cluster-group-replication-part2.md`
9. `test-codemode-cluster-innodb-part1.md`
10. `test-codemode-cluster-innodb-part2.md`
11. `test-codemode-core-write.md`
12. `test-codemode-docstore-collections-part1.md`
13. `test-codemode-docstore-collections-part2.md`
14. `test-codemode-docstore-documents.md`
15. `test-codemode-events-part1.md`
16. `test-codemode-events-part2.md`
17. `test-codemode-fulltext-part1.md`
18. `test-codemode-fulltext-part2.md`
19. `test-codemode-introspection-part1.md`
20. `test-codemode-introspection-part2.md`
21. `test-codemode-json-core-read.md`
22. `test-codemode-json-core-write-part1.md`
23. `test-codemode-json-core-write-part2.md`
24. `test-codemode-json-enhanced-part1.md`
25. `test-codemode-json-enhanced-part2.md`
26. `test-codemode-json-helpers.md`
27. `test-codemode-migration-part1.md`
28. `test-codemode-migration-part2.md`
29. `test-codemode-monitoring-part1.md`
30. `test-codemode-monitoring-part2.md`
31. `test-codemode-optimization.md`
32. `test-codemode-partitioning.md`
33. `test-codemode-performance-analysis-queries.md`
34. `test-codemode-performance-analysis-system.md`
35. `test-codemode-performance-anomaly.md`
36. `test-codemode-proxysql-config.md`
37. `test-codemode-proxysql-status-part1.md`
38. `test-codemode-proxysql-status-part2.md`
39. `test-codemode-replication-part1.md`
40. `test-codemode-replication-part2.md`
41. `test-codemode-roles-grants.md`
42. `test-codemode-roles-management.md`
43. `test-codemode-router-core.md`
44. `test-codemode-router-routes-part1.md`
45. `test-codemode-router-routes-part2.md`
46. `test-codemode-schema-management-part1.md`
47. `test-codemode-schema-management-part2.md`
48. `test-codemode-schema-routines-part1.md`
49. `test-codemode-schema-routines-part2.md`
50. `test-codemode-security-audit.md`
51. `test-codemode-security-firewall-part1.md`
52. `test-codemode-security-firewall-part2.md`
53. `test-codemode-shell-data-part1.md`
54. `test-codemode-shell-data-part2.md`
55. `test-codemode-shell-utils.md`
56. `test-codemode-spatial-geometry.md`
57. `test-codemode-spatial-operations.md`
58. `test-codemode-spatial-queries.md`
59. `test-codemode-spatial-setup.md`
60. `test-codemode-stats-advanced-part1.md`
61. `test-codemode-stats-advanced-part2.md`
62. `test-codemode-stats-analytics.md`
63. `test-codemode-stats-basic-part1.md`
64. `test-codemode-stats-basic-part2.md`
65. `test-codemode-stats-window-part1.md`
66. `test-codemode-stats-window-part2.md`
67. `test-codemode-sys-analysis.md`
68. `test-codemode-sys-metrics.md`
69. `test-codemode-text-part1.md`
70. `test-codemode-text-part2.md`
71. `test-codemode-transactions-part1.md`
72. `test-codemode-transactions-part2.md`
73. `test-codemode-vector-management.md`
74. `test-codemode-vector-search.md`
75. `test-codemode-vector-storage.md`
76. `test-codemode-versioning.md`
77. `test-codemode-sandbox.md`



## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `mysql://metrics`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

Once all subagents have completed their tests, check your records. If ANY subagent applied code fixes during the run:

1. Briefly summarize the specific code fixes made during the pass (you do not need to summarize changes made to testing prompts, only code).
2. Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build` in that order.
3. Run the full test suites using `pnpm run test:vitest` and `pnpm run test:e2e` (in either order). **CRITICAL**: If any tests fail, you (the Coordinator agent) MUST debug and fix the broken tests before proceeding. Do NOT leave the test suite in a broken state.
4. Message the user: "The test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

# mysql-mcp Code Mode Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Oversees testing for **Code Mode** parity, alongside **OAuth 2.1** and **Connection Pooling**.

We're working on the mysql-mcp project/repository in this thread.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Code Mode test suite using subagents.

## Goal

Systematically execute all Code Mode tests in `test-server/test-codemode/` to verify sandbox isolation, workflow orchestration, payload optimization, and error handling. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time) according to the Dependency DAG below. Parallel execution may cause conflicts or server instability.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint && pnpm run typecheck`. They MUST SKIP `pnpm run test` and `pnpm run test:e2e`. The coordinator will run `pnpm run check` to validate the full suite at the end. Ensure the local checks pass cleanly and any resulting errors are fixed.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`git commit -m "..."`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied [Y Prompt / Z Code]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code]`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
   - Ensure subagents explicitly check that Code Mode scripts do NOT leak raw MCP exceptions, returning `{ success: false }` for domain errors.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router, shell) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for tool calls like `mysql_execute_code`). If the subagent targets the standard `mysql` server, it will improperly test graceful degradation instead of actively testing the live cluster, which is a FAILURE of the test.
5. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "This is test X out of Y. Fixed Z issues [W Prompt / V Code]." (e.g., "This is test 40 out of 46. Fixed 10 issues [2 Prompt / 8 Code].")
   - Do NOT output any other text to the user during the test sequence. Do not wrap the message in quotes or add preamble.
6. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-codemode/` BEFORE starting, and cross-reference the actual directory contents against the list below.
   - The Coordinator MUST explicitly create a checklist (e.g., using a `task.md` artifact) copying the exact Test Sequence Queue to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or this file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.

## Test Sequence Queue (Dependency DAG)

1. `test-codemode-core-read.md` (**MUST PASS FIRST**)
2. `test-codemode-admin-audit.md`
3. `test-codemode-admin-maintenance.md`
4. `test-codemode-backup-data.md`
5. `test-codemode-backup-audit.md`
6. `test-codemode-cluster-group-replication.md`
7. `test-codemode-cluster-innodb.md`
8. `test-codemode-core-write.md`
9. `test-codemode-docstore-collections.md`
10. `test-codemode-docstore-documents.md`
11. `test-codemode-events.md`
12. `test-codemode-fulltext.md`
13. `test-codemode-introspection.md`
14. `test-codemode-json-core-read.md`
15. `test-codemode-json-core-write.md`
16. `test-codemode-json-enhanced.md`
17. `test-codemode-json-helpers.md`
18. `test-codemode-migration.md`
19. `test-codemode-monitoring.md`
20. `test-codemode-optimization.md`
21. `test-codemode-partitioning.md`
22. `test-codemode-performance-analysis-queries.md`
23. `test-codemode-performance-analysis-system.md`
24. `test-codemode-performance-anomaly.md`
25. `test-codemode-proxysql-config.md`
26. `test-codemode-proxysql-status.md`
27. `test-codemode-replication.md`
28. `test-codemode-roles-management.md`
29. `test-codemode-roles-grants.md`
30. `test-codemode-router-core.md`
31. `test-codemode-router-routes.md`
32. `test-codemode-schema-management.md`
33. `test-codemode-schema-routines.md`
34. `test-codemode-security-audit.md`
35. `test-codemode-security-firewall.md`
36. `test-codemode-shell-data.md`
37. `test-codemode-shell-utils.md`
38. `test-codemode-spatial-geometry.md`
39. `test-codemode-spatial-operations.md`
40. `test-codemode-spatial-queries.md`
41. `test-codemode-spatial-setup.md`
42. `test-codemode-stats-advanced.md`
43. `test-codemode-stats-basic.md`
44. `test-codemode-stats-analytics.md`
45. `test-codemode-stats-window.md`
46. `test-codemode-sys-metrics.md`
47. `test-codemode-sys-analysis.md`
48. `test-codemode-text.md`
49. `test-codemode-transactions.md`
50. `test-codemode-vector-management.md`
51. `test-codemode-vector-search.md`
52. `test-codemode-vector-storage.md`
53. `test-codemode-versioning.md`

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `memory://metrics/summary`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

At the absolute end of the testing suite, check your records. If ANY subagent applied fixes during the run:

1. Message the main agent: "The test suite is complete. Fixes were applied during the run. Please ask the user to restart the server ONCE, and then we will run a final validation sweep."

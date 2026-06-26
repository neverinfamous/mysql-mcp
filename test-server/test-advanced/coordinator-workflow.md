# mysql-mcp Advanced Code Mode Testing Coordinator Workflow

We're working in the `mysql-mcp` project in this thread.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Advanced Code Mode test suite using subagents.

## Goal

Systematically execute all Advanced Code Mode tests in `test-server/test-advanced/` to verify sandbox isolation, workflow orchestration, payload optimization, and error handling for complex, multi-step agentic sequences. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time) according to the Dependency DAG below. Parallel execution may cause conflicts or server instability.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint && pnpm run typecheck`. They MUST SKIP `pnpm run test` and `pnpm run test:e2e` as the coordinator will run the full suite at the end. Ensure the local checks pass cleanly and any resulting errors are fixed.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`git commit -m "..."`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied [Y Prompt / Z Code]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code]`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - Ensure subagents explicitly check that Code Mode scripts do NOT leak raw MCP exceptions, returning `{ success: false }` for domain errors.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router, shell) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for tool calls like `mysql_execute_code`). If the subagent targets the standard `mysql` server, it will improperly test graceful degradation instead of actively testing the live cluster, which is a FAILURE of the test.
5. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "This is test X out of 53. Fixed Z issues [W Prompt / V Code]."
   - Do NOT output any other text to the user during the test sequence.

## Test Sequence Queue (Dependency DAG)

1. `test-codemode-advanced-core.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-admin-control.md`
3. `test-codemode-advanced-admin-maintenance.md`
4. `test-codemode-advanced-backup-audit.md`
5. `test-codemode-advanced-backup-export.md`
6. `test-codemode-advanced-cluster-group-replication.md`
7. `test-codemode-advanced-cluster-innodb.md`
8. `test-codemode-advanced-concurrency.md`
9. `test-codemode-advanced-docstore-collections.md`
10. `test-codemode-advanced-docstore-documents.md`
11. `test-codemode-advanced-events.md`
12. `test-codemode-advanced-fulltext.md`
13. `test-codemode-advanced-introspection.md`
14. `test-codemode-advanced-json-core.md`
15. `test-codemode-advanced-json-enhanced.md`
16. `test-codemode-advanced-json-helpers.md`
17. `test-codemode-advanced-migration.md`
18. `test-codemode-advanced-monitoring-health.md`
19. `test-codemode-advanced-monitoring-status.md`
20. `test-codemode-advanced-optimization.md`
21. `test-codemode-advanced-partitioning.md`
22. `test-codemode-advanced-performance-analysis.md`
23. `test-codemode-advanced-performance-anomaly.md`
24. `test-codemode-advanced-proxysql-config.md`
25. `test-codemode-advanced-proxysql-status.md`
26. `test-codemode-advanced-replication.md`
27. `test-codemode-advanced-roles-assignment.md`
28. `test-codemode-advanced-roles-management.md`
29. `test-codemode-advanced-router-advanced.md`
30. `test-codemode-advanced-router-routes.md`
31. `test-codemode-advanced-schema-management.md`
32. `test-codemode-advanced-schema-routines.md`
33. `test-codemode-advanced-security-audit.md`
34. `test-codemode-advanced-security-system.md`
35. `test-codemode-advanced-sessions.md`
36. `test-codemode-advanced-shell-data.md`
37. `test-codemode-advanced-shell-utils.md`
38. `test-codemode-advanced-spatial-geometry.md`
39. `test-codemode-advanced-spatial-operations.md`
40. `test-codemode-advanced-spatial-queries.md`
41. `test-codemode-advanced-spatial-setup.md`
42. `test-codemode-advanced-stats-advanced.md`
43. `test-codemode-advanced-stats-descriptive.md`
44. `test-codemode-advanced-stats-time-series.md`
45. `test-codemode-advanced-stats-window.md`
46. `test-codemode-advanced-sys.md`
47. `test-codemode-advanced-text.md`
48. `test-codemode-advanced-transactions.md`
49. `test-codemode-advanced-vector-management.md`
50. `test-codemode-advanced-vector-search.md`
51. `test-codemode-advanced-vector-storage.md`
52. `test-codemode-advanced-versioning.md`
53. `test-codemode-sandbox.md`

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `memory://metrics/summary`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

At the absolute end of the testing suite, check your records. If ANY subagent applied fixes during the run:

1. Message the main agent: "The test suite is complete. Fixes were applied during the run. Please ask the user to restart the server ONCE, and then we will run a final validation sweep."

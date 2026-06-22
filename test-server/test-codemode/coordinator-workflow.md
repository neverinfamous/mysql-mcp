# mysql-mcp Code Mode Testing Coordinator Workflow

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
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run check; pnpm run build; pnpm run test; pnpm run test:e2e`. They must ensure these pass completely cleanly. This explicitly means ensuring that **lint, typecheck, vitest, and playwright MUST ALL BE PASSING completely cleanly** and any resulting errors are fixed.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - Once local CI passes (or if no fixes were needed), the subagent MUST update `UNRELEASED.md` with all changes.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`git commit -m "..."`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied`** (e.g., **`0 fixes applied`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite.
   - Ensure subagents explicitly check that Code Mode scripts do NOT leak raw MCP exceptions, returning `{ success: false }` for domain errors.
   - **Tool Availability Warning**: If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user.
   - **CRITICAL ECOSYSTEM REQUIREMENT**: The ecosystem tools (cluster, proxysql, router, shell) run on a different MCP config (`mysql-ecosystem`). When testing any ecosystem tools, the subagent MUST explicitly target the `mysql-ecosystem` server (e.g., `ServerName: "mysql-ecosystem"` for tool calls like `mysql_execute_code`). If the subagent targets the standard `mysql` server, it will improperly test graceful degradation instead of actively testing the live cluster, which is a FAILURE of the test.
5. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "This is test X out of Y. Fixed Z issues."
   - Do NOT output any other text to the user during the test sequence.

## Test Sequence Queue (Dependency DAG)

1. `test-codemode-core.md` (**MUST PASS FIRST**)
2. `test-codemode-admin.md`
3. `test-codemode-backup.md`
4. `test-codemode-cluster-group-replication.md`
5. `test-codemode-cluster-innodb.md`
6. `test-codemode-docstore.md`
7. `test-codemode-events.md`
8. `test-codemode-fulltext.md`
9. `test-codemode-introspection.md`
10. `test-codemode-json-core.md`
11. `test-codemode-json-enhanced.md`
12. `test-codemode-json-helpers.md`
13. `test-codemode-migration.md`
14. `test-codemode-monitoring.md`
15. `test-codemode-optimization.md`
16. `test-codemode-partitioning.md`
17. `test-codemode-performance-analysis.md`
18. `test-codemode-performance-anomaly.md`
19. `test-codemode-proxysql-config.md`
20. `test-codemode-proxysql-status.md`
21. `test-codemode-replication.md`
22. `test-codemode-roles.md`
23. `test-codemode-router.md`
24. `test-codemode-schema-management.md`
25. `test-codemode-schema-routines.md`
26. `test-codemode-security.md`
27. `test-codemode-shell-data.md`
28. `test-codemode-shell-utils.md`
29. `test-codemode-spatial-geometry.md`
30. `test-codemode-spatial-operations.md`
31. `test-codemode-spatial-queries.md`
32. `test-codemode-spatial-setup.md`
33. `test-codemode-stats-advanced.md`
34. `test-codemode-stats-descriptive.md`
35. `test-codemode-stats-window.md`
36. `test-codemode-sys.md`
37. `test-codemode-text.md`
38. `test-codemode-transactions.md`
39. `test-codemode-vector-management.md`
40. `test-codemode-vector-search.md`
41. `test-codemode-vector-storage.md`
42. `test-codemode-versioning.md`

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `memory://metrics/summary`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

At the absolute end of the testing suite, check your records. If ANY subagent applied fixes during the run:

1. Message the main agent: "The test suite is complete. Fixes were applied during the run. Please ask the user to restart the server ONCE, and then we will run a final validation sweep."

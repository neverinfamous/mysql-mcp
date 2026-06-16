# Tool Groups Testing Coordinator Workflow

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Tool Groups test suite using subagents.

## Goal
Systematically execute all standard tool group tests in `test-server/test-tool-groups/` to verify behavioral correctness, parameter validation, error handling, and output schemas. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time) according to the Dependency DAG below. Parallel execution may cause conflicts or server instability.
2. **Subagent Delegation**: 
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt, along with these execution requirements.
3. **Runtime Configuration (Tool Filter)**:
   - **CRITICAL**: Before executing its tests, the subagent MUST attempt to update the server's active tool group to match its target group (e.g., `admin`, `backup`) using the server's runtime configuration tools (e.g., `mysql_set_config` or similar config tool if available).
   - If the configuration tool is unavailable or fails, the subagent should log this, and you (the Coordinator) may need to prompt the user to manually switch the tool filter. But the subagent MUST try first!
4. **Validation and Immediate Continuation**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run check; pnpm run build; pnpm run test; pnpm run test:e2e`. They must ensure these pass completely cleanly.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - Once local CI passes (or if no fixes were needed), the subagent MUST update `UNRELEASED.md` with all changes.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`git commit -m "..."`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, and immediately move to the next test in the queue.
   - If the subagent applied any fixes, they MUST explicitly note this in their final message to you so you can track that a final live verification sweep will be needed at the very end of the suite.
   - Ensure subagents explicitly check that tools return structured MCP errors, not raw exceptions. Error messages should follow the standard `[LEVEL] [module] [CODE] message (context)` format where applicable.

## Test Sequence Queue (Dependency DAG)

1. `test-core.md` (**MUST PASS FIRST**)
2. `test-admin.md`
3. `test-backup.md`
4. `test-cluster-group-replication.md`
5. `test-cluster-innodb.md`
6. `test-docstore.md`
7. `test-events.md`
8. `test-fulltext.md`
9. `test-introspection.md`
10. `test-json-core.md`
11. `test-json-enhanced.md`
12. `test-json-helpers.md`
13. `test-migration.md`
14. `test-monitoring.md`
15. `test-optimization.md`
16. `test-partitioning.md`
17. `test-performance-analysis.md`
18. `test-performance-anomaly.md`
19. `test-proxysql-config.md`
20. `test-proxysql-status.md`
21. `test-replication.md`
22. `test-roles.md`
23. `test-router.md`
24. `test-schema-management.md`
25. `test-schema-routines.md`
26. `test-security.md`
27. `test-shell-data.md`
28. `test-shell-utils.md`
29. `test-spatial-geometry.md`
30. `test-spatial-operations.md`
31. `test-spatial-queries.md`
32. `test-spatial-setup.md`
33. `test-stats-advanced.md`
34. `test-stats-descriptive.md`
35. `test-stats-window.md`
36. `test-sys.md`
37. `test-text.md`
38. `test-transactions.md`
39. `test-vector-management.md`
40. `test-vector-search.md`
41. `test-vector-storage.md`
42. `test-versioning.md`

## Telemetry Collection
When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `memory://metrics/summary`) from all subagents into a final report for the user.

## Post-Suite Validation
At the absolute end of the testing suite, check your records. If ANY subagent applied fixes during the run:
1. Message the main agent: "The test suite is complete. Fixes were applied during the run. Please ask the user to restart the server ONCE, and then we will run a final validation sweep."

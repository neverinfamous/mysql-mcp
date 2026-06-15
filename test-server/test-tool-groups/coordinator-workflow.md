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
3. **Validation and Server Restart Coordination**:
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run check; pnpm run build; pnpm run test; pnpm run test:e2e`. They must ensure these pass completely cleanly BEFORE requesting a server refresh.
   - After passing local CI, the subagent is instructed to pause and message you: *"Please manually refresh the `mysql-mcp` server, then say 'ready' so I can verify the fix."*
   - When you receive this message, DO NOT proceed. Surface the message to the user and wait for them to manually refresh the server.
   - Once the user confirms the server is ready, use the `send_message` tool to pass the "ready" signal to the waiting subagent.
4. **Finalization and Commit**:
   - The subagent MUST explicitly verify the fixes work properly after the server is restarted.
   - Once confirmed, the subagent MUST update `UNRELEASED.md` with all changes.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`git commit -m "..."`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, and move to the next test in the queue.
5. **Structured Error Handling**:
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

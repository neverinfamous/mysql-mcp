# Advanced Code Mode Testing Coordinator Workflow

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Advanced Code Mode test suite using subagents.

## Goal
Systematically execute all Advanced Code Mode tests in `test-server/test-advanced/` to verify sandbox isolation, workflow orchestration, payload optimization, and error handling for complex, multi-step agentic sequences. You will delegate testing to subagents, ensuring high-fidelity results and structured error handling, while compiling telemetry.

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
5. **Code Mode Constraints (P401)**:
   - Ensure subagents explicitly check that Code Mode scripts do NOT leak raw MCP exceptions, returning `{ success: false }` for domain errors.

## Test Sequence Queue (Dependency DAG)

1. `test-codemode-advanced-core.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-admin.md`
3. `test-codemode-advanced-backup.md`
4. `test-codemode-advanced-cluster-group-replication.md`
5. `test-codemode-advanced-cluster-innodb.md`
6. `test-codemode-advanced-concurrency.md`
7. `test-codemode-advanced-docstore.md`
8. `test-codemode-advanced-events.md`
9. `test-codemode-advanced-fulltext.md`
10. `test-codemode-advanced-introspection.md`
11. `test-codemode-advanced-json-core.md`
12. `test-codemode-advanced-json-enhanced.md`
13. `test-codemode-advanced-json-helpers.md`
14. `test-codemode-advanced-migration.md`
15. `test-codemode-advanced-monitoring.md`
16. `test-codemode-advanced-optimization.md`
17. `test-codemode-advanced-partitioning.md`
18. `test-codemode-advanced-performance-analysis.md`
19. `test-codemode-advanced-performance-anomaly.md`
20. `test-codemode-advanced-proxysql-config.md`
21. `test-codemode-advanced-proxysql-status.md`
22. `test-codemode-advanced-replication.md`
23. `test-codemode-advanced-roles.md`
24. `test-codemode-advanced-router.md`
25. `test-codemode-advanced-schema-management.md`
26. `test-codemode-advanced-schema-routines.md`
27. `test-codemode-advanced-security.md`
28. `test-codemode-advanced-sessions.md`
29. `test-codemode-advanced-shell-data.md`
30. `test-codemode-advanced-shell-utils.md`
31. `test-codemode-advanced-spatial-geometry.md`
32. `test-codemode-advanced-spatial-operations.md`
33. `test-codemode-advanced-spatial-queries.md`
34. `test-codemode-advanced-spatial-setup.md`
35. `test-codemode-advanced-stats-advanced.md`
36. `test-codemode-advanced-stats-descriptive.md`
37. `test-codemode-advanced-stats-window.md`
38. `test-codemode-advanced-sys.md`
39. `test-codemode-advanced-text.md`
40. `test-codemode-advanced-transactions.md`
41. `test-codemode-advanced-vector-management.md`
42. `test-codemode-advanced-vector-search.md`
43. `test-codemode-advanced-vector-storage.md`
44. `test-codemode-advanced-versioning.md`
45. `test-codemode-sandbox.md`

## Telemetry Collection
When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `memory://metrics/summary`) from all subagents into a final report for the user.

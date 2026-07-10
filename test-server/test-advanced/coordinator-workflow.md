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
   - If a subagent modifies the codebase to fix an issue, the subagent MUST validate all changes locally by running `pnpm run lint`, `pnpm run typecheck`, and only the relevant `vitest` and `playwright` tests (do NOT run the entire test suites). Ensure the local checks and relevant tests pass cleanly and any resulting errors are fixed. If the subagent ONLY modified documentation or prompts, they should NOT run any validation.
   - The subagent will **NOT** pause or request a server refresh. They must trust the local CI validation.
4. **Finalization and Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - **CRITICAL PRIORITY**: NEVER delete a testing prompt or workflow file after success.
   - The subagent MUST update `test-server/code-map.md` if file structures or exports change.
   - The subagent MUST generate updated server instructions by running `npx tsx scripts/generate-server-instructions.ts`.
   - The subagent MUST commit all changes locally (`bun .\.agents\scripts\commit.ts --msg "test(advanced): ..." --impact 0.1 --confidence 1.0 --validation passed --journal --add .`).
   - The subagent MUST then create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes.
   - Once the subagent completes, record their final token estimate and metric telemetry, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and immediately move to the next test in the queue.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you, and explicitly report if any tests triggered graceful degradation. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied [Y Prompt / Z Code] [W Graceful Fails]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code] [0 Graceful Fails]`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
## Test Sequence Queue (Dependency DAG)

1. `test-codemode-advanced-admin-control-part1.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-admin-control-part2.md`
3. `test-codemode-advanced-admin-maintenance-part1.md`
4. `test-codemode-advanced-admin-maintenance-part2.md`
5. `test-codemode-advanced-backup-audit-part1.md`
6. `test-codemode-advanced-backup-audit-part2.md`
7. `test-codemode-advanced-backup-export.md`
8. `test-codemode-advanced-cluster-group-replication-part1.md`
9. `test-codemode-advanced-cluster-group-replication-part2.md`
10. `test-codemode-advanced-cluster-innodb-part1.md`
11. `test-codemode-advanced-cluster-innodb-part2.md`
12. `test-codemode-advanced-concurrency.md`
13. `test-codemode-advanced-core-part1a.md`
14. `test-codemode-advanced-core-part1b.md`
15. `test-codemode-advanced-core-part2a.md`
16. `test-codemode-advanced-docstore-collections-part1.md`
17. `test-codemode-advanced-docstore-collections-part2.md`
18. `test-codemode-advanced-docstore-documents-part1.md`
19. `test-codemode-advanced-docstore-documents-part2.md`
20. `test-codemode-advanced-events-part1.md`
21. `test-codemode-advanced-events-part2.md`
22. `test-codemode-advanced-fulltext-part1.md`
23. `test-codemode-advanced-fulltext-part2.md`
24. `test-codemode-advanced-introspection-part1.md`
25. `test-codemode-advanced-introspection-part2.md`
26. `test-codemode-advanced-json-core-part1a.md`
27. `test-codemode-advanced-json-core-part1b.md`
28. `test-codemode-advanced-json-core-part2a.md`
29. `test-codemode-advanced-json-core-part2b.md`
30. `test-codemode-advanced-json-enhanced-part1.md`
31. `test-codemode-advanced-json-enhanced-part2.md`
32. `test-codemode-advanced-json-helpers.md`
33. `test-codemode-advanced-migration-part1.md`
34. `test-codemode-advanced-migration-part2.md`
35. `test-codemode-advanced-monitoring-health-part1.md`
36. `test-codemode-advanced-monitoring-health-part2.md`
37. `test-codemode-advanced-monitoring-status.md`
38. `test-codemode-advanced-optimization-part1.md`
39. `test-codemode-advanced-optimization-part2.md`
40. `test-codemode-advanced-partitioninga.md`
41. `test-codemode-advanced-partitioningb.md`
42. `test-codemode-advanced-performance-analysis-part1a.md`
43. `test-codemode-advanced-performance-analysis-part1b.md`
44. `test-codemode-advanced-performance-analysis-part2a.md`
45. `test-codemode-advanced-performance-analysis-part2b.md`
46. `test-codemode-advanced-performance-anomaly.md`
47. `test-codemode-advanced-proxysql-config-part1.md`
48. `test-codemode-advanced-proxysql-config-part2.md`
49. `test-codemode-advanced-proxysql-status-part1.md`
50. `test-codemode-advanced-proxysql-status-part2.md`
51. `test-codemode-advanced-replication-part1.md`
52. `test-codemode-advanced-replication-part2.md`
53. `test-codemode-advanced-roles-assignment-part1.md`
54. `test-codemode-advanced-roles-assignment-part2.md`
55. `test-codemode-advanced-roles-management-part1.md`
56. `test-codemode-advanced-roles-management-part2.md`
57. `test-codemode-advanced-router-advanced-part1.md`
58. `test-codemode-advanced-router-advanced-part2.md`
59. `test-codemode-advanced-router-routes-part1.md`
60. `test-codemode-advanced-router-routes-part2.md`
61. `test-codemode-advanced-schema-management.md`
62. `test-codemode-advanced-schema-routines.md`
63. `test-codemode-advanced-schema-triggers.md`
64. `test-codemode-advanced-schema-views.md`
65. `test-codemode-advanced-security-audit-part1.md`
66. `test-codemode-advanced-security-audit-part2.md`
67. `test-codemode-advanced-security-system-part1.md`
68. `test-codemode-advanced-security-system-part2.md`
69. `test-codemode-advanced-sessions.md`
70. `test-codemode-advanced-shell-data-part1.md`
71. `test-codemode-advanced-shell-data-part2.md`
72. `test-codemode-advanced-shell-utils-part1a.md`
73. `test-codemode-advanced-shell-utils-part1b.md`
74. `test-codemode-advanced-shell-utils-part2.md`
75. `test-codemode-advanced-spatial-geometry.md`
76. `test-codemode-advanced-spatial-operations.md`
77. `test-codemode-advanced-spatial-queries.md`
78. `test-codemode-advanced-spatial-setup.md`
79. `test-codemode-advanced-stats-advanced-part1.md`
80. `test-codemode-advanced-stats-advanced-part2.md`
81. `test-codemode-advanced-stats-descriptive-part1.md`
82. `test-codemode-advanced-stats-descriptive-part2.md`
83. `test-codemode-advanced-stats-time-series-part1.md`
84. `test-codemode-advanced-stats-time-series-part2.md`
85. `test-codemode-advanced-stats-window-part1.md`
86. `test-codemode-advanced-stats-window-part2.md`
87. `test-codemode-advanced-sys-part1a.md`
88. `test-codemode-advanced-sys-part1b.md`
89. `test-codemode-advanced-sys-part2a.md`
90. `test-codemode-advanced-sys-part2b.md`
91. `test-codemode-advanced-text-part1.md`
92. `test-codemode-advanced-text-part2.md`
93. `test-codemode-advanced-transactions-part1a.md`
94. `test-codemode-advanced-transactions-part1b.md`
95. `test-codemode-advanced-transactions-part2.md`
96. `test-codemode-advanced-types-binary.md`
97. `test-codemode-advanced-types-date.md`
98. `test-codemode-advanced-types-json.md`
99. `test-codemode-advanced-types-numeric.md`
100. `test-codemode-advanced-vector-management-part1.md`
101. `test-codemode-advanced-vector-management-part2.md`
102. `test-codemode-advanced-vector-search-part1.md`
103. `test-codemode-advanced-vector-search-part2.md`
104. `test-codemode-advanced-vector-storage.md`
105. `test-codemode-advanced-versioning-part1.md`
106. `test-codemode-advanced-versioning-part2.md`
107. `test-codemode-sandbox.md`

## Telemetry Collection

When the suite finishes, compile the **Total Token Estimate** and resource metrics (e.g., `mysql://metrics`) from all subagents into a final report for the user. Also, report the **Total Number of Issues Fixed** during the entire suite.

## Post-Suite Validation

Once all subagents have completed their tests, check your records. If ANY subagent applied code fixes during the run:

1. Briefly summarize the specific code fixes made during the pass (you do not need to summarize changes made to testing prompts, only code).
2. Run `pnpm run lint`, `pnpm run typecheck`, and `pnpm run build` in that order.
3. Run the full test suites using `pnpm run test:vitest` and `pnpm run test:e2e` (in either order). **CRITICAL**: If any tests fail, you (the Coordinator agent) MUST debug and fix the broken tests before proceeding. Do NOT leave the test suite in a broken state.
4. Message the user: "The test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

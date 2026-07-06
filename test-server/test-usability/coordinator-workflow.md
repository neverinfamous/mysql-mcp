# mysql-mcp Usability Testing Coordinator Workflow

> 🚀 **Core Features Tested:** Validates the agent interaction experience with **OAuth 2.1**, **Code Mode**, and **Docker**.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

We're working in the `mysql-mcp` project in this thread.

This guide instructs the Coordinator agent on how to run the `mysql-mcp` usability test suite using subagents.

## Goal

Execute all usability tests in `test-server/test-usability/` to fuzz the `mysql-mcp` tools and explicitly trigger agent hallucinations. Harden the codebase against these hallucinations via the [`mysql-mcp-heal`](../../skills/mysql-mcp-heal/SKILL.md) skill.

## Workflow Rules

1. **Sequential Execution**: Tests MUST be executed sequentially (one subagent at a time). The server schemas, proxy logic, and `server-instructions` are central files, and parallel mutation will cause git conflicts and require overlapping local CI runs.
2. **Subagent Delegation**:
   - Use the `invoke_subagent` tool to spawn a `self` subagent for each test file.
   - Provide the exact path to the test file as the subagent's prompt.
3. **Local Verification (NO PAUSING)**:
   - If you or a subagent modifies the codebase, the subagent MUST validate all changes locally by running `pnpm run check`. Ensure the checks pass cleanly and any resulting errors are fixed.
   - **Quality Gates**: Pay strict attention to ESLint and TypeScript compiler outputs. You MUST fix all lint and typecheck validation issues prior to committing. Do NOT ignore warnings or errors. Follow strict TypeScript guidelines: NEVER use `any` (use `unknown` with type guards), avoid unsafe typecasts, and ensure explicit return types.
   - **WARNING**: Do NOT commit your code and then attempt to use `git commit --amend` to fix a lingering lint or test issue later. Amending a commit rewrites the commit SHA, which will permanently break the changelog tracking workflow.
   - DO NOT perform live server verification. DO NOT wait for a server restart. DO NOT pause or send a message asking the user to refresh the server.
   - If a subagent edits any `server-instructions/*.md` files, they MUST run `npx tsx scripts/generate-server-instructions.ts` before building.
4. **Commit**:
   - The subagent MUST delete any temporary test artifacts (like data exports or scratch files) they generated when done.
   - Once all local tests pass, the subagent will commit the code (`bun .\.agents\scripts\commit.ts --msg "test(usability): Optimize [group] tool usage" --impact 0.1 --confidence 1.0 --validation passed --journal --add .`), create a session summary journal entry using the `/mcp:memory-journal-mcp:session-summary` prompt ONLY if they made code changes, summarize findings, and exit. If no modifications were needed, no commit or journal entry is required.
   - The subagent MUST explicitly state if they applied any fixes in their final message to you. Instruct the subagent to ALWAYS format this string exactly as **`X fixes applied [Y Prompt / Z Code]`** (e.g., **`0 fixes applied [0 Prompt / 0 Code]`**) in bold at the very top of their final result summary, so you can track that a final live verification sweep will be needed at the very end of the suite, and whether the fix was to the testing prompt itself or code.
   - **CRITICAL**: The subagent MUST include an explicit status line in their final message: `STATUS: SUCCESS` if the test ran and passed, or `STATUS: FAILED_FILE_NOT_FOUND` if the file does not exist.
   - Once the subagent completes, mark the task as done, kill the subagent using the `manage_subagents` tool (action: `kill`), and move to the next test in the queue.
5. **Code Mode Error Testing Protocol**:
   - Subagents executing Code Mode test matrices must anticipate structured `VALIDATION_ERROR` or other domain error payloads with `{ success: false }` for type mismatches, rather than expecting sandbox crashes or thrown raw exceptions.
6. **Tool Availability Warning**:
   - If any tools are unavailable during testing for any reason, the subagent MUST immediately warn the user. NOTE: The ecosystem tools (cluster, proxysql, router, shell) are running on a different port/MCP config (`mysql-ecosystem`) than the standard tools/tool groups. Ecosystem should be enabled for them already, but if it isn't working, the subagent MUST let the user know immediately so they can enable it. We want to actively test ecosystem, not just test graceful degradation.
7. **Coordinator Progress Reporting**:
   - The Coordinator MUST respond to the user with ONLY this exact format as each test proceeds: "This is test X out of 89. Fixed Z issues [W Prompt / V Code]."
   - Do NOT output any other text to the user during the test sequence.
8. **Strict Verification and Anti-Hallucination**:
   - The Coordinator MUST use the `list_dir` tool on `test-server/test-usability/` BEFORE starting, and cross-reference the actual directory contents against the list below.
   - The Coordinator MUST explicitly create a checklist (e.g., using a `task.md` artifact) copying the exact Test Sequence Queue to track progress.
   - NEVER rely on memory for filenames or current test counts. ALWAYS read your exact position from the checklist artifact or this file.
   - If a subagent reports `STATUS: FAILED_FILE_NOT_FOUND`, the Coordinator MUST halt the test sequence immediately and report the error to the user. Do NOT blindly increment the counter or count it as a successful test.

## Test Sequence Queue

1. `test-usability-core-part1.md`
2. `test-usability-core-part2.md`
3. `test-usability-core-part3.md`
4. `test-usability-core-part4.md`
5. `test-usability-json-part1.md`
6. `test-usability-json-part2.md`
7. `test-usability-json-part3.md`
8. `test-usability-json-part4.md`
9. `test-usability-json-part5.md`
10. `test-usability-json-part6.md`
11. `test-usability-text-part1.md`
12. `test-usability-text-part2.md`
13. `test-usability-fulltext-part1.md`
14. `test-usability-fulltext-part2.md`
15. `test-usability-performance-part1.md`
16. `test-usability-performance-part2.md`
17. `test-usability-performance-part3.md`
18. `test-usability-performance-part4.md`
19. `test-usability-optimization-part1.md`
20. `test-usability-optimization-part2.md`
21. `test-usability-admin-part1.md`
22. `test-usability-admin-part2.md`
23. `test-usability-admin-part3.md`
24. `test-usability-monitoring-part1.md`
25. `test-usability-monitoring-part2.md`
26. `test-usability-monitoring-part3.md`
27. `test-usability-backup-part1.md`
28. `test-usability-backup-part2.md`
29. `test-usability-backup-part3.md`
30. `test-usability-replication-part1.md`
31. `test-usability-replication-part2.md`
32. `test-usability-partitioning-part1.md`
33. `test-usability-partitioning-part2.md`
34. `test-usability-transactions-part1.md`
35. `test-usability-transactions-part2.md`
36. `test-usability-transactions-part3.md`
37. `test-usability-router-part1.md`
38. `test-usability-router-part2.md`
39. `test-usability-router-part3.md`
40. `test-usability-proxysql-part1.md`
41. `test-usability-proxysql-part2.md`
42. `test-usability-proxysql-part3.md`
43. `test-usability-proxysql-part4.md`
44. `test-usability-shell-part1.md`
45. `test-usability-shell-part2.md`
46. `test-usability-shell-part3.md`
47. `test-usability-shell-part4.md`
48. `test-usability-schema-part1.md`
49. `test-usability-schema-part2.md`
50. `test-usability-schema-part3.md`
51. `test-usability-schema-part4.md`
52. `test-usability-events-part1.md`
53. `test-usability-events-part2.md`
54. `test-usability-sysschema-part1.md`
55. `test-usability-sysschema-part2.md`
56. `test-usability-sysschema-part3.md`
57. `test-usability-stats-part1.md`
58. `test-usability-stats-part2.md`
59. `test-usability-stats-part3.md`
60. `test-usability-stats-part4.md`
61. `test-usability-stats-part5.md`
62. `test-usability-stats-part6.md`
63. `test-usability-stats-part7.md`
64. `test-usability-spatial-part1.md`
65. `test-usability-spatial-part2.md`
66. `test-usability-spatial-part3.md`
67. `test-usability-spatial-part4.md`
68. `test-usability-security-part1.md`
69. `test-usability-security-part2.md`
70. `test-usability-security-part3.md`
71. `test-usability-cluster-part1.md`
72. `test-usability-cluster-part2.md`
73. `test-usability-cluster-part3.md`
74. `test-usability-cluster-part4.md`
75. `test-usability-roles-part1.md`
76. `test-usability-roles-part2.md`
77. `test-usability-roles-part3.md`
78. `test-usability-docstore-part1.md`
79. `test-usability-docstore-part2.md`
80. `test-usability-docstore-part3.md`
81. `test-usability-introspection-part1.md`
82. `test-usability-introspection-part2.md`
83. `test-usability-migration-part1.md`
84. `test-usability-migration-part2.md`
85. `test-usability-vector-part1.md`
86. `test-usability-vector-part2.md`
87. `test-usability-vector-part3.md`
88. `test-usability-vector-part4.md`
89. `test-usability-codemode.md`

## Finalization

Once all subagents have completed their tests:

1. Run `pnpm run check` to execute the full test suite. **CRITICAL**: If any tests fail, you (the Coordinator agent) MUST debug and fix the broken tests before proceeding. Do NOT leave the test suite in a broken state.
2. Message the user: "The usability test suite is complete. Fixes were applied during the run. Please manually restart the server ONCE so we can perform a final live validation sweep."

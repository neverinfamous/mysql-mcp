# MySQL MCP Usability Testing - Phase 4: Analytics

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

1. **State Management:** Before starting, create a `task.md` artifact with the 23 tests listed below as a checklist. Update it after each test.
2. **Execution:** Execute tests sequentially. Invoke a single `self` subagent for each test.
3. **Reporting:** When a subagent finishes, kill it to save context. You MUST report progress to me using this exact format: 
   `Test X (<name>) out of 23: A Prompt Fixes / B Code Fixes / C Infrastructure Absent`

## Subagent Instructions

When calling `invoke_subagent`, you MUST use the following exact prompt (replacing `{test_file}`):

<subagent_prompt>

<task>

Read and execute the usability test: {test_file} (located in `test-server/test-usability/`).

</task>

<instructions>

Follow the rules in `coordinator-workflow-phase4-analytics.md`, subject to these strict overrides:

1. **Code Mode Testing:** Test tools organically using Code Mode (`mysql_execute_code`). DO NOT use `call_mcp_tool` directly or `run_command` to execute bash scripts as a substitute for MCP tools.

2. **Environment Immutability:** DO NOT modify `mcp_config.json` manually to change ports or environment variables (e.g., bypassing the router). You must test against the default environment provided.

3. **No Full Validation:** DO NOT run `pnpm run check` or `pnpm run test` manually. The restart script handles all necessary compilation.

4. **Code Fixes & TDD Verification:** If you make a code fix to resolve a hallucination, you MUST verify it. First, run `pnpm run lint` and `pnpm run typecheck` to ensure your code is clean and will not crash the server. Then, PAUSE and ask the user to manually click the "Refresh" button in the IDE UI to restart the server before you continue testing. DO NOT attempt to run any scripts like `restart-mcp.ts` as they will not work.

5. **Infrastructure Absent:** If a tool's primary execution (the "happy path") cannot be completed due to missing infrastructure, credentials, or binaries, you MUST count it as "Infrastructure Absent" (e.g., +1 Infrastructure Absent). You may fix the code to handle the missing infrastructure gracefully, but you MUST still report it as Infrastructure Absent. *(Note: As stated in the test files, replication tests returning `null` on the primary node is a VALID success state, not an infrastructure absence).*

6. **Handoff:** When complete, stop calling tools to await further instructions. DO NOT loop.

7. **Database Locks:** If a test requires DDL operations and fails due to `super_read_only`, you MUST toggle the lock using `run_command` to execute `node test-server/infrastructure/scripts/toggle-super-read.mjs OFF` before the test, and `ON` after. Do not attempt to use `docker exec` or `mysql-node1`.

8. **DO NOT Edit the Test Markdown File:** The `{test_file}` is strictly read-only. DO NOT check the `[ ]` task boxes or fill out the markdown tables inside it, as your manual edits will be wiped out by the generator script. Track all your findings, fuzzed payloads, and results strictly via `mj_execute_code` in your `memory-journal-mcp` entry and your final summary.

* Note: mysql-mcp is project #9 in the memory-journal-mcp system/database.

When creating memory journal entries via `mj_execute_code`, use this exact format to ensure success:
```javascript
mj.core.createEntry({
  content: "Your concise summary of findings/bug fixes here...",
  entry_type: "bug_fix", // or "decision", "architecture" (do NOT use "retrospective")
  tags: ["testing", "mysql-mcp"],
  project_number: 9
});
```

</instructions>
</subagent_prompt>

## Test Sequence Queue (Phase 4: Analytics)

1. test-usability-backup-part1.md
2. test-usability-backup-part2.md
3. test-usability-backup-part3.md
4. test-usability-backup-part4.md
5. test-usability-cluster-part1.md
6. test-usability-cluster-part2.md
7. test-usability-cluster-part3.md
8. test-usability-cluster-part4.md
9. test-usability-cluster-part5.md
10. test-usability-docstore-part1.md
11. test-usability-docstore-part2.md
12. test-usability-docstore-part3.md
13. test-usability-docstore-part4.md
14. test-usability-docstore-part5.md
15. test-usability-fulltext-part1.md
16. test-usability-fulltext-part2.md
17. test-usability-fulltext-part3.md
18. test-usability-introspection-part1.md
19. test-usability-introspection-part2.md
20. test-usability-introspection-part3.md
21. test-usability-migration-part1.md
22. test-usability-migration-part2.md
23. test-usability-migration-part3.md
24. test-usability-monitoring-part1.md
25. test-usability-monitoring-part2.md
26. test-usability-monitoring-part3.md
27. test-usability-monitoring-part4.md
28. test-usability-optimization-part1.md
29. test-usability-optimization-part2.md
30. test-usability-partitioning-part1.md
31. test-usability-partitioning-part2.md
32. test-usability-proxysql-part1.md
33. test-usability-proxysql-part2.md
34. test-usability-proxysql-part3.md
35. test-usability-proxysql-part4.md
36. test-usability-proxysql-part5.md
37. test-usability-proxysql-part6.md
38. test-usability-replication-part1.md
39. test-usability-replication-part2.md
40. test-usability-replication-part3.md
41. test-usability-roles-part1.md
42. test-usability-roles-part2.md
43. test-usability-roles-part3.md
44. test-usability-roles-part4.md
45. test-usability-router-part1.md
46. test-usability-router-part2.md
47. test-usability-router-part3.md
48. test-usability-router-part4.md
49. test-usability-router-part5.md
50. test-usability-security-part1.md
51. test-usability-security-part2.md
52. test-usability-security-part3.md
53. test-usability-security-part4.md
54. test-usability-security-part5.md
55. test-usability-shell-part1.md
56. test-usability-shell-part2.md
57. test-usability-shell-part3.md
58. test-usability-shell-part4.md
59. test-usability-shell-part5.md
60. test-usability-spatial-part1.md
61. test-usability-spatial-part2.md
62. test-usability-spatial-part3.md
63. test-usability-spatial-part4.md
64. test-usability-spatial-part5.md
65. test-usability-spatial-part6.md
66. test-usability-sysschema-part1.md
67. test-usability-sysschema-part2.md
68. test-usability-sysschema-part3.md
69. test-usability-sysschema-part4.md
70. test-usability-transactions-part1.md
71. test-usability-transactions-part2.md
72. test-usability-transactions-part3.md
73. test-usability-transactions-part4.md
74. test-usability-vector-part1.md
75. test-usability-vector-part2.md
76. test-usability-vector-part3.md
77. test-usability-vector-part4.md
78. test-usability-vector-part5.md
79. test-usability-vector-part6.md

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

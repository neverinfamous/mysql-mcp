# MySQL MCP Direct Usability Testing - Phase 4: Analytics

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

1. **State Management:** Before starting, create a `task.md` artifact with the 62 tests listed below as a checklist. Update it after each test.
2. **Execution:** Execute tests sequentially. Invoke a single `self` subagent for each test.
3. **Reporting:** When a subagent finishes, kill it to save context. You MUST report progress to me using this exact format: 
   `Test X (<name>) out of 62: A Prompt Fixes / B Code Fixes / C Infrastructure Absent`

## Subagent Instructions

When calling `invoke_subagent`, you MUST use the following exact prompt (replacing `{test_file}`):

<subagent_prompt>

<task>

Read and execute the usability test: {test_file} (located in `test-server/test-usability-direct/`).

</task>

<instructions>

Follow the rules in `coordinator-workflow-phase4-analytics.md`, subject to these strict overrides:

1. **Native MCP Testing:** Test tools organically using `call_mcp_tool`. DO NOT use `run_command` to execute bash scripts as a substitute for MCP tools.

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

1. `test-usability-direct-fulltext-part1.md` (**MUST PASS FIRST**)
2. `test-usability-direct-fulltext-part2.md`
3. `test-usability-direct-fulltext-part3.md`
4. `test-usability-direct-optimization-part1.md`
5. `test-usability-direct-optimization-part2.md`
6. `test-usability-direct-replication-part1.md`
7. `test-usability-direct-replication-part2.md`
8. `test-usability-direct-replication-part3.md`
9. `test-usability-direct-router-part1.md`
10. `test-usability-direct-router-part2.md`
11. `test-usability-direct-router-part3.md`
12. `test-usability-direct-router-part4.md`
13. `test-usability-direct-router-part5.md`
14. `test-usability-direct-proxysql-part1.md`
15. `test-usability-direct-proxysql-part2.md`
16. `test-usability-direct-proxysql-part3.md`
17. `test-usability-direct-proxysql-part4.md`
18. `test-usability-direct-proxysql-part5.md`
19. `test-usability-direct-proxysql-part6.md`
20. `test-usability-direct-shell-part1.md`
21. `test-usability-direct-shell-part2.md`
22. `test-usability-direct-shell-part3.md`
23. `test-usability-direct-shell-part4.md`
24. `test-usability-direct-shell-part5.md`
25. `test-usability-direct-events-part1.md`
26. `test-usability-direct-events-part2.md`
27. `test-usability-direct-events-part3.md`
28. `test-usability-direct-sysschema-part1.md`
29. `test-usability-direct-sysschema-part2.md`
30. `test-usability-direct-sysschema-part3.md`
31. `test-usability-direct-sysschema-part4.md`
32. `test-usability-direct-spatial-part1.md`
33. `test-usability-direct-spatial-part2.md`
34. `test-usability-direct-spatial-part3.md`
35. `test-usability-direct-spatial-part4.md`
36. `test-usability-direct-spatial-part5.md`
37. `test-usability-direct-spatial-part6.md`
38. `test-usability-direct-security-part1.md`
39. `test-usability-direct-security-part2.md`
40. `test-usability-direct-security-part3.md`
41. `test-usability-direct-security-part4.md`
42. `test-usability-direct-security-part5.md`
43. `test-usability-direct-cluster-part1.md`
44. `test-usability-direct-cluster-part2.md`
45. `test-usability-direct-cluster-part3.md`
46. `test-usability-direct-cluster-part4.md`
47. `test-usability-direct-cluster-part5.md`
48. `test-usability-direct-roles-part1.md`
49. `test-usability-direct-roles-part2.md`
50. `test-usability-direct-roles-part3.md`
51. `test-usability-direct-roles-part4.md`
52. `test-usability-direct-docstore-part1.md`
53. `test-usability-direct-docstore-part2.md`
54. `test-usability-direct-docstore-part3.md`
55. `test-usability-direct-docstore-part4.md`
56. `test-usability-direct-docstore-part5.md`
57. `test-usability-direct-vector-part1.md`
58. `test-usability-direct-vector-part2.md`
59. `test-usability-direct-vector-part3.md`
60. `test-usability-direct-vector-part4.md`
61. `test-usability-direct-vector-part5.md`
62. `test-usability-direct-vector-part6.md`

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.


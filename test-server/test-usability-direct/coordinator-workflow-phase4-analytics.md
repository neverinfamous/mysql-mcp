# MySQL MCP Direct Usability Testing - Phase 4: Analytics

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

# Subagent Instructions
When calling `invoke_subagent`, you MUST use the following exact prompt (replacing `{test_file}`):

<subagent_prompt>
Execute the usability test: {test_file} (located in `test-server/test-usability-direct/`)
Follow the rules in `coordinator-workflow-phase4-analytics.md` with these strict overrides:

1. **USE MCP TOOLS NATIVELY:** You must organically test the tools using the native `call_mcp_tool` interface (directly providing the JSON arguments via tool call). **DO NOT** substitute use of the terminal `run_command` tool to run scripts or bash commands.
2. **NO CONFIG CHANGES OR RESTARTS:** Do NOT adjust `mcp_config.json` and do NOT restart the MCP server under any circumstances. If you encounter any problems in this regard, or if you run into an "Infrastructure Absent" problem, you MUST just stop and tell me.
3. **NO FULL TEST SUITE RUNS:** CRITICAL: Do NOT run `pnpm run test`, `check`, or `build`. Only run `pnpm run lint` and `pnpm run typecheck` and only if changes/fixes are made.
4. **INFRASTRUCTURE ABSENT CLARIFICATION:** "Infrastructure Absent" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS INFRASTRUCTURE ABSENT.
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


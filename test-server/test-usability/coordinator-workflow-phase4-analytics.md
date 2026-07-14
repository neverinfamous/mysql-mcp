# MySQL MCP Usability Testing - Phase 4: Analytics

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 48).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: Analytics)

1. `test-usability-backup-part1.md` (**MUST PASS FIRST**)
2. `test-usability-backup-part2.md`
3. `test-usability-backup-part3.md`
4. `test-usability-cluster-part1.md`
5. `test-usability-cluster-part2.md`
6. `test-usability-cluster-part3.md`
7. `test-usability-cluster-part4.md`
8. `test-usability-docstore-part1.md`
9. `test-usability-docstore-part2.md`
10. `test-usability-docstore-part3.md`
11. `test-usability-fulltext-part1.md`
12. `test-usability-fulltext-part2.md`
13. `test-usability-monitoring-part1.md`
14. `test-usability-monitoring-part2.md`
15. `test-usability-monitoring-part3.md`
16. `test-usability-optimization-part1.md`
17. `test-usability-optimization-part2.md`
18. `test-usability-partitioning-part1.md`
19. `test-usability-partitioning-part2.md`
20. `test-usability-proxysql-part1.md`
21. `test-usability-proxysql-part2.md`
22. `test-usability-proxysql-part3.md`
23. `test-usability-proxysql-part4.md`
24. `test-usability-roles-part1.md`
25. `test-usability-roles-part2.md`
26. `test-usability-roles-part3.md`
27. `test-usability-router-part1.md`
28. `test-usability-router-part2.md`
29. `test-usability-router-part3.md`
30. `test-usability-security-part1.md`
31. `test-usability-security-part2.md`
32. `test-usability-security-part3.md`
33. `test-usability-shell-part1.md`
34. `test-usability-shell-part2.md`
35. `test-usability-shell-part3.md`
36. `test-usability-shell-part4.md`
37. `test-usability-spatial-part1.md`
38. `test-usability-spatial-part2.md`
39. `test-usability-spatial-part3.md`
40. `test-usability-spatial-part4.md`
41. `test-usability-sysschema-part1.md`
42. `test-usability-sysschema-part2.md`
43. `test-usability-transactions-part1.md`
44. `test-usability-transactions-part2.md`
45. `test-usability-transactions-part3.md`
46. `test-usability-vector-part1.md`
47. `test-usability-vector-part2.md`
48. `test-usability-vector-part3.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

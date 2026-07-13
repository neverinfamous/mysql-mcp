# MySQL MCP Code Mode Testing - Phase 2: Data & Performance (JSON, Migration, Perf, Rep)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 26).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 2: Data & Performance (JSON, Migration, Perf, Rep))

1. `test-codemode-json-core-read.md`
2. `test-codemode-json-core-write-part1.md`
3. `test-codemode-json-core-write-part2.md`
4. `test-codemode-json-enhanced-part1.md`
5. `test-codemode-json-enhanced-part2.md`
6. `test-codemode-json-helpers-part1.md`
7. `test-codemode-json-helpers-part2.md`
8. `test-codemode-migration-part1a.md`
9. `test-codemode-migration-part1b.md`
10. `test-codemode-migration-part2a.md`
11. `test-codemode-migration-part2b.md`
12. `test-codemode-monitoring-part1a.md`
13. `test-codemode-monitoring-part1b.md`
14. `test-codemode-monitoring-part2a.md`
15. `test-codemode-monitoring-part2b.md`
16. `test-codemode-monitoring-part2c.md`
17. `test-codemode-optimization-part1.md`
18. `test-codemode-optimization-part2.md`
19. `test-codemode-partitioning-part1.md`
20. `test-codemode-partitioning-part2.md`
21. `test-codemode-performance-analysis-queries-part1.md`
22. `test-codemode-performance-analysis-queries-part2.md`
23. `test-codemode-performance-analysis-system-part1.md`
24. `test-codemode-performance-analysis-system-part2a.md`
25. `test-codemode-performance-analysis-system-part2b.md`
26. `test-codemode-performance-anomaly.md`
27. `test-codemode-proxysql-config-part1.md`
28. `test-codemode-proxysql-config-part2.md`
29. `test-codemode-proxysql-status-part1a.md`
30. `test-codemode-proxysql-status-part1b.md`
31. `test-codemode-proxysql-status-part2a.md`
32. `test-codemode-proxysql-status-part2b.md`
33. `test-codemode-proxysql-status-part2c.md`
34. `test-codemode-replication-part1.md`
35. `test-codemode-replication-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

# MySQL MCP Advanced Code Mode Testing - Phase 2: Performance

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 27).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 2: Performance)

1. `test-codemode-advanced-json-core-part1a.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-json-core-part1b.md`
3. `test-codemode-advanced-json-core-part2a.md`
4. `test-codemode-advanced-json-core-part2b.md`
5. `test-codemode-advanced-json-enhanced-part1.md`
6. `test-codemode-advanced-json-enhanced-part2.md`
7. `test-codemode-advanced-json-helpers.md`
8. `test-codemode-advanced-migration-part1.md`
9. `test-codemode-advanced-migration-part2.md`
10. `test-codemode-advanced-monitoring-health-part1.md`
11. `test-codemode-advanced-monitoring-health-part2.md`
12. `test-codemode-advanced-monitoring-status.md`
13. `test-codemode-advanced-optimization-part1.md`
14. `test-codemode-advanced-optimization-part2.md`
15. `test-codemode-advanced-partitioning-part1.md`
16. `test-codemode-advanced-partitioning-part2.md`
17. `test-codemode-advanced-performance-analysis-part1a.md`
18. `test-codemode-advanced-performance-analysis-part1b.md`
19. `test-codemode-advanced-performance-analysis-part2a.md`
20. `test-codemode-advanced-performance-analysis-part2b.md`
21. `test-codemode-advanced-performance-anomaly.md`
22. `test-codemode-advanced-proxysql-config-part1.md`
23. `test-codemode-advanced-proxysql-config-part2.md`
24. `test-codemode-advanced-proxysql-status-part1.md`
25. `test-codemode-advanced-proxysql-status-part2.md`
26. `test-codemode-advanced-replication-part1.md`
27. `test-codemode-advanced-replication-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

# MySQL MCP Code Mode Testing - Phase 4: Analytics & Sandbox (Spatial, Stats, Sys, Vector)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 30).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: Analytics & Sandbox (Spatial, Stats, Sys, Vector))

1. `test-codemode-spatial-geometry.md` (**MUST PASS FIRST**)
2. `test-codemode-spatial-operations-part1.md`
3. `test-codemode-spatial-operations-part2.md`
4. `test-codemode-spatial-queries-part1.md`
5. `test-codemode-spatial-queries-part2.md`
6. `test-codemode-spatial-setup.md`
7. `test-codemode-stats-advanced-part1a.md`
8. `test-codemode-stats-advanced-part1b.md`
9. `test-codemode-stats-analytics.md`
10. `test-codemode-stats-basic-part1.md`
11. `test-codemode-stats-basic-part2.md`
12. `test-codemode-stats-window-part1a.md`
13. `test-codemode-stats-window-part1b.md`
14. `test-codemode-sys-analysis-part1.md`
15. `test-codemode-sys-analysis-part2.md`
16. `test-codemode-sys-metrics-part1.md`
17. `test-codemode-sys-metrics-part2.md`
18. `test-codemode-text-part1a.md`
19. `test-codemode-text-part1b.md`
20. `test-codemode-transactions-part1a.md`
21. `test-codemode-transactions-part1b.md`
22. `test-codemode-transactions-part2a.md`
23. `test-codemode-vector-management-part1.md`
24. `test-codemode-vector-management-part2.md`
25. `test-codemode-vector-search.md`
26. `test-codemode-vector-storage-part1.md`
27. `test-codemode-vector-storage-part2.md`
28. `test-codemode-versioning-part1.md`
29. `test-codemode-versioning-part2.md`
30. `test-codemode-sandbox.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

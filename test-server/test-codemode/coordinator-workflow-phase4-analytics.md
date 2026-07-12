# MySQL MCP Code Mode Testing - Phase 4: Analytics & Sandbox (Spatial, Stats, Sys, Vector)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 0).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: Analytics & Sandbox (Spatial, Stats, Sys, Vector))

1. `test-codemode-spatial-setup.md`
2. `test-codemode-stats-advanced-part1.md`
3. `test-codemode-stats-advanced-part2.md`
4. `test-codemode-stats-analytics.md`
5. `test-codemode-stats-basic-part1.md`
6. `test-codemode-stats-basic-part2.md`
7. `test-codemode-stats-window-part1.md`
8. `test-codemode-stats-window-part2.md`
9. `test-codemode-sys-analysis-part1.md`
10. `test-codemode-sys-analysis-part2.md`
11. `test-codemode-sys-metrics-part1.md`
12. `test-codemode-sys-metrics-part2.md`
13. `test-codemode-text-part1.md`
14. `test-codemode-text-part2.md`
15. `test-codemode-transactions-part1a.md`
16. `test-codemode-transactions-part1b.md`
17. `test-codemode-transactions-part2.md`
18. `test-codemode-vector-management-part1.md`
19. `test-codemode-vector-management-part2.md`
20. `test-codemode-vector-search.md`
21. `test-codemode-vector-storage-part1.md`
22. `test-codemode-vector-storage-part2.md`
23. `test-codemode-versioning-part1.md`
24. `test-codemode-versioning-part2.md`
25. `test-codemode-sandbox.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

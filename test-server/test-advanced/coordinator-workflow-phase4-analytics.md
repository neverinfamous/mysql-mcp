# MySQL MCP Advanced Code Mode Testing - Phase 4: Analytics

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 26).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: Analytics)

1. `test-codemode-advanced-stats-advanced-part1.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-stats-advanced-part2.md`
3. `test-codemode-advanced-stats-descriptive-part1.md`
4. `test-codemode-advanced-stats-descriptive-part2.md`
5. `test-codemode-advanced-stats-time-series-part1.md`
6. `test-codemode-advanced-stats-time-series-part2.md`
7. `test-codemode-advanced-stats-window-part1.md`
8. `test-codemode-advanced-stats-window-part2.md`
9. `test-codemode-advanced-sys-part1a.md`
10. `test-codemode-advanced-sys-part1b.md`
11. `test-codemode-advanced-sys-part2a.md`
12. `test-codemode-advanced-sys-part2b.md`
13. `test-codemode-advanced-text-part1.md`
14. `test-codemode-advanced-text-part2.md`
15. `test-codemode-advanced-transactions-part1a.md`
16. `test-codemode-advanced-transactions-part1b.md`
17. `test-codemode-advanced-transactions-part2.md`
18. `test-codemode-advanced-types-binary.md`
19. `test-codemode-advanced-types-date.md`
20. `test-codemode-advanced-types-json.md`
21. `test-codemode-advanced-types-numeric.md`
22. `test-codemode-advanced-vector-management-part1.md`
23. `test-codemode-advanced-vector-management-part2.md`
24. `test-codemode-advanced-vector-search-part1.md`
25. `test-codemode-advanced-vector-search-part2.md`
26. `test-codemode-advanced-vector-storage.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

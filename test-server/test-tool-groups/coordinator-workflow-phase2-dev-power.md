# MySQL MCP Tool Groups Testing - Phase 2: Dev-power

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Ensure the user has started the server with the `dev-power` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 13).
- Terminate subagents when done to save context.

## Test Sequence Queue

1. `test-fulltext-part1a.md` (**MUST PASS FIRST**)
2. `test-fulltext-part1b.md`
3. `test-fulltext-part2a.md`
4. `test-performance-analysis-queries-part1.md`
5. `test-performance-analysis-queries-part2.md`
6. `test-performance-analysis-system-part1.md`
7. `test-performance-analysis-system-part2a.md`
8. `test-performance-anomaly.md`
9. `test-schema-management-part1a.md`
10. `test-schema-management-part1b.md`
11. `test-schema-management-part2a.md`
12. `test-schema-routines-part1.md`
13. `test-schema-routines-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

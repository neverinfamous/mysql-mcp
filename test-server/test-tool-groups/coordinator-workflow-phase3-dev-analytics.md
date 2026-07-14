# MySQL MCP Tool Groups Testing - Phase 3: Dev-analytics

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.

- **CRITICAL WARNING FOR SUBAGENTS:** "Infrastructure Absent" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS INFRASTRUCTURE ABSENT.
- Ensure the user has started the server with the `dev-analytics` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Infrastructure Absent" (Where Y is 13).
- Terminate subagents when done to save context.

## Test Sequence Queue

1. `test-stats-advanced-part1a.md` (**MUST PASS FIRST**)
2. `test-stats-advanced-part1c.md`
3. `test-stats-advanced-part1b.md`
4. `test-stats-advanced-part1d.md`
5. `test-stats-analytics-part1.md`
6. `test-stats-analytics-part2.md`
7. `test-stats-basic-part1.md`
8. `test-stats-basic-part3.md`
9. `test-stats-basic-part2.md`
10. `test-stats-window-part1a.md`
11. `test-stats-window-part1c.md`
12. `test-stats-window-part1b.md`
13. `test-stats-window-part1d.md`

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:

1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

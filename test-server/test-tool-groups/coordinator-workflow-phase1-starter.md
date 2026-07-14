# MySQL MCP Tool Groups Testing - Phase 1: Starter

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Ensure the user has started the server with the `starter` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 24).
- Terminate subagents when done to save context.

## Test Sequence Queue

1. `test-core-read-part1.md` (**MUST PASS FIRST**)
2. `test-core-read-part2.md`
3. `test-core-write-part1.md`
4. `test-core-write-part2.md`
5. `test-json-core-read-part1.md`
6. `test-json-core-read-part2.md`
7. `test-json-core-write-part1.md`
8. `test-json-core-write-part3.md`
9. `test-json-core-write-part2.md`
10. `test-json-enhanced-part1.md`
11. `test-json-enhanced-part2-part1.md`
12. `test-json-enhanced-part2-part2.md`
13. `test-json-helpers-part1.md`
14. `test-json-helpers-part2.md`
15. `test-text-part1a.md`
16. `test-text-part1c.md`
17. `test-text-part1b.md`
18. `test-text-part1d.md`
19. `test-transactions-part1a.md`
20. `test-transactions-part1b.md`
21. `test-transactions-part2a.md`
22. `test-transactions-part2b.md`
23. `test-versioning-part1.md`
24. `test-versioning-part2.md`

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:

1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

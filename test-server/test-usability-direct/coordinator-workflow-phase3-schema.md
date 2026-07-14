# MySQL MCP Direct Usability Testing - Phase 3: Schema

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 24).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 3: Schema)

1. `test-usability-direct-partitioning-part1.md` (**MUST PASS FIRST**)
2. `test-usability-direct-partitioning-part2.md`
3. `test-usability-direct-schema-part1.md`
4. `test-usability-direct-schema-part2.md`
5. `test-usability-direct-schema-part3.md`
6. `test-usability-direct-schema-part4.md`
7. `test-usability-direct-schema-part5.md`
8. `test-usability-direct-schema-part6.md`
9. `test-usability-direct-stats-part1.md`
10. `test-usability-direct-stats-part2.md`
11. `test-usability-direct-stats-part3.md`
12. `test-usability-direct-stats-part4.md`
13. `test-usability-direct-stats-part5.md`
14. `test-usability-direct-stats-part6.md`
15. `test-usability-direct-stats-part7.md`
16. `test-usability-direct-stats-part8.md`
17. `test-usability-direct-stats-part9.md`
18. `test-usability-direct-stats-part10.md`
19. `test-usability-direct-introspection-part1.md`
20. `test-usability-direct-introspection-part2.md`
21. `test-usability-direct-introspection-part3.md`
22. `test-usability-direct-migration-part1.md`
23. `test-usability-direct-migration-part2.md`
24. `test-usability-direct-migration-part3.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

# MySQL MCP Direct Usability Testing - Phase 2: Admin

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.



## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 23).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 2: Admin)

1. `test-usability-direct-admin-part1.md` (**MUST PASS FIRST**)
2. `test-usability-direct-admin-part2.md`
3. `test-usability-direct-admin-part3.md`
4. `test-usability-direct-admin-part4.md`
5. `test-usability-direct-admin-part5.md`
6. `test-usability-direct-backup-part1.md`
7. `test-usability-direct-backup-part2.md`
8. `test-usability-direct-backup-part3.md`
9. `test-usability-direct-backup-part4.md`
10. `test-usability-direct-monitoring-part1.md`
11. `test-usability-direct-monitoring-part2.md`
12. `test-usability-direct-monitoring-part3.md`
13. `test-usability-direct-monitoring-part4.md`
14. `test-usability-direct-performance-part1.md`
15. `test-usability-direct-performance-part2.md`
16. `test-usability-direct-performance-part3.md`
17. `test-usability-direct-performance-part4.md`
18. `test-usability-direct-performance-part5.md`
19. `test-usability-direct-performance-part6.md`
20. `test-usability-direct-transactions-part1.md`
21. `test-usability-direct-transactions-part2.md`
22. `test-usability-direct-transactions-part3.md`
23. `test-usability-direct-transactions-part4.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

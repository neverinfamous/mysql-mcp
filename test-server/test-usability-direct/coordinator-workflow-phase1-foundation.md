# MySQL MCP Direct Usability Testing - Phase 1: Foundation

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Infrastructure Absent" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS INFRASTRUCTURE ABSENT.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Infrastructure Absent" (Where Y is 18).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation)

1. `test-usability-direct-core-part1.md` (**MUST PASS FIRST**)
2. `test-usability-direct-core-part2.md`
3. `test-usability-direct-core-part3.md`
4. `test-usability-direct-core-part4.md`
5. `test-usability-direct-core-part5.md`
6. `test-usability-direct-core-part6.md`
7. `test-usability-direct-json-part1.md`
8. `test-usability-direct-json-part2.md`
9. `test-usability-direct-json-part3.md`
10. `test-usability-direct-json-part4.md`
11. `test-usability-direct-json-part5.md`
12. `test-usability-direct-json-part6.md`
13. `test-usability-direct-json-part7.md`
14. `test-usability-direct-json-part8.md`
15. `test-usability-direct-json-part9.md`
16. `test-usability-direct-text-part1.md`
17. `test-usability-direct-text-part2.md`
18. `test-usability-direct-text-part3.md`

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

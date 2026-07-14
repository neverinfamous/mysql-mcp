# MySQL MCP Usability Testing - Phase 1: Foundation

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 10).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation)

1. `test-usability-core-part1.md` (**MUST PASS FIRST**)
2. `test-usability-core-part2.md`
3. `test-usability-core-part3.md`
4. `test-usability-core-part4.md`
5. `test-usability-json-part1.md`
6. `test-usability-json-part2.md`
7. `test-usability-json-part3.md`
8. `test-usability-json-part4.md`
9. `test-usability-json-part5.md`
10. `test-usability-json-part6.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

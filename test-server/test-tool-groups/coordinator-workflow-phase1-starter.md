# MySQL MCP Tool Groups Testing - Phase 1 (starter)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Ensure the user has started the server with the `starter` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 17).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: `starter`)

- `test-core-part1.md` (**MUST PASS FIRST**)
- `test-core-part2.md`
- `test-core-part3.md`
- `test-core-part4.md`
- `test-codemode.md`
- `test-json-core-part1.md`
- `test-json-core-part2.md`
- `test-json-core-part3.md`
- `test-json-enhanced-part1.md`
- `test-json-enhanced-part2.md`
- `test-json-helpers-part1.md`
- `test-json-helpers-part2.md`
- `test-transactions-part1.md`
- `test-transactions-part2.md`
- `test-transactions-part3.md`
- `test-text-part1.md`
- `test-text-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

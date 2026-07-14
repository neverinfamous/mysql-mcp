# MySQL MCP Tool Groups Testing - Phase 4: Ai-data-nosql

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules

Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.

- **CRITICAL WARNING FOR SUBAGENTS:** "Infrastructure Absent" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS INFRASTRUCTURE ABSENT.
- Ensure the user has started the server with the `ai-data-nosql` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Infrastructure Absent" (Where Y is 5).
- Terminate subagents when done to save context.

## Test Sequence Queue

1. `test-docstore-collections-part1.md` (**MUST PASS FIRST**)
2. `test-docstore-collections-part3.md`
3. `test-docstore-collections-part2.md`
4. `test-docstore-documents-part1.md`
5. `test-docstore-documents-part2.md`

## Completion

Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:

1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

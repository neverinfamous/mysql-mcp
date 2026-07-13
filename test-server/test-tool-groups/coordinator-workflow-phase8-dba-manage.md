# MySQL MCP Tool Groups Testing - Phase 8 (dba-manage)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Ensure the user has started the server with the `dba-manage` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 12).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 8: `dba-manage`)

- `test-admin-part1.md`
- `test-admin-part2.md`
- `test-admin-part3.md`
- `test-backup-part1.md`
- `test-backup-part2.md`
- `test-backup-part3.md`
- `test-replication-part1.md`
- `test-replication-part2.md`
- `test-partitioning-part1.md`
- `test-partitioning-part2.md`
- `test-events-part1.md`
- `test-events-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

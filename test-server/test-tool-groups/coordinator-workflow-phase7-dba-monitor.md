# MySQL MCP Tool Groups Testing - Phase 7 (dba-monitor)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Ensure the user has started the server with the `dba-monitor` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 8).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 7: `dba-monitor`)

- `test-monitoring-part1.md`
- `test-monitoring-part2.md`
- `test-monitoring-part3.md`
- `test-sys-part1.md`
- `test-sys-part2.md`
- `test-sys-part3.md`
- `test-optimization-part1.md`
- `test-optimization-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

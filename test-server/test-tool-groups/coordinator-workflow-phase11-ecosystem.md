# MySQL MCP Tool Groups Testing - Phase 11 (ecosystem)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Ensure the user has started the server with the `ecosystem` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 15).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 11: `ecosystem`)

- `test-cluster-gr.md`
- `test-cluster-innodb-part1.md`
- `test-cluster-innodb-part2.md`
- `test-cluster-innodb-part3.md`
- `test-proxysql-part1.md`
- `test-proxysql-part2.md`
- `test-proxysql-part3.md`
- `test-proxysql-part4.md`
- `test-router-part1.md`
- `test-router-part2.md`
- `test-router-part3.md`
- `test-shell-part1.md`
- `test-shell-part2.md`
- `test-shell-part3.md`
- `test-shell-part4.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

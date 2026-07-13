# MySQL MCP Tool Groups Testing - Phase 11: Ecosystem

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Ensure the user has started the server with the `ecosystem` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 15).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 11: Ecosystem)

1. `test-cluster-gr.md` (**MUST PASS FIRST**)
2. `test-cluster-innodb-part1.md`
3. `test-cluster-innodb-part2.md`
4. `test-cluster-innodb-part3.md`
5. `test-proxysql-part1.md`
6. `test-proxysql-part2.md`
7. `test-proxysql-part3.md`
8. `test-proxysql-part4.md`
9. `test-router-part1.md`
10. `test-router-part2.md`
11. `test-router-part3.md`
12. `test-shell-part1.md`
13. `test-shell-part2.md`
14. `test-shell-part3.md`
15. `test-shell-part4.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

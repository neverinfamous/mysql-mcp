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
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 22).
- Terminate subagents when done to save context.

## Test Sequence Queue

1. `test-cluster-group-replication-part1.md` (**MUST PASS FIRST**)
2. `test-cluster-group-replication-part3.md`
3. `test-cluster-group-replication-part2.md`
4. `test-cluster-innodb-part1.md`
5. `test-cluster-innodb-part3.md`
6. `test-cluster-innodb-part2.md`
7. `test-proxysql-config-part1.md`
8. `test-proxysql-config-part2.md`
9. `test-proxysql-status-part1a.md`
10. `test-proxysql-status-part1b.md`
11. `test-proxysql-status-part2a.md`
12. `test-proxysql-status-part2b.md`
13. `test-router-core-part1.md`
14. `test-router-core-part2.md`
15. `test-router-routes-part1.md`
16. `test-router-routes-part3.md`
17. `test-router-routes-part2.md`
18. `test-shell-data-part1a.md`
19. `test-shell-data-part1b.md`
20. `test-shell-data-part2a.md`
21. `test-shell-data-part2b.md`
22. `test-shell-utils.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

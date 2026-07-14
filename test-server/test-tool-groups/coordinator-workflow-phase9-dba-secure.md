# MySQL MCP Tool Groups Testing - Phase 9: Dba-secure

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Ensure the user has started the server with the `dba-secure` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 9).
- Terminate subagents when done to save context.

## Test Sequence Queue

1. `test-roles-grants-part1.md` (**MUST PASS FIRST**)
2. `test-roles-grants-part2.md`
3. `test-roles-management-part1.md`
4. `test-roles-management-part2.md`
5. `test-security-audit-part1.md`
6. `test-security-audit-part2.md`
7. `test-security-firewall-part1.md`
8. `test-security-firewall-part2-part1.md`
9. `test-security-firewall-part2-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

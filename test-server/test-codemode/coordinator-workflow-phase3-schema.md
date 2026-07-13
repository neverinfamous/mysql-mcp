# MySQL MCP Code Mode Testing - Phase 3: Schema & Security (Roles, Router, Schema, Security)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 24).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 3: Schema & Security (Roles, Router, Schema, Security))

1. `test-codemode-roles-grants-part1.md`
2. `test-codemode-roles-grants-part2.md`
3. `test-codemode-roles-management-part1.md`
4. `test-codemode-roles-management-part2.md`
5. `test-codemode-router-core-part1.md`
6. `test-codemode-router-core-part2.md`
7. `test-codemode-router-routes-part1.md`
8. `test-codemode-router-routes-part2.md`
9. `test-codemode-schema-management-part1a.md`
10. `test-codemode-schema-management-part1b.md`
11. `test-codemode-schema-management-part2a.md`
12. `test-codemode-schema-management-part2b.md`
13. `test-codemode-schema-management-part2c.md`
14. `test-codemode-schema-routines-part1.md`
15. `test-codemode-schema-routines-part2.md`
16. `test-codemode-security-audit-part1.md`
17. `test-codemode-security-audit-part2.md`
18. `test-codemode-security-firewall-part1.md`
19. `test-codemode-security-firewall-part2.md`
20. `test-codemode-shell-data-part1a.md`
21. `test-codemode-shell-data-part1b.md`
22. `test-codemode-shell-data-part2a.md`
23. `test-codemode-shell-data-part2b.md`
24. `test-codemode-shell-utils.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

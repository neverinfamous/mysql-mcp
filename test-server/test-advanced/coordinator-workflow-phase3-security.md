# MySQL MCP Advanced Code Mode Testing - Phase 3: Security

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 30).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 3: Security)

1. `test-codemode-advanced-roles-assignment-part1.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-roles-assignment-part2.md`
3. `test-codemode-advanced-roles-management-part1.md`
4. `test-codemode-advanced-roles-management-part2.md`
5. `test-codemode-advanced-router-advanced-part1.md`
6. `test-codemode-advanced-router-advanced-part2.md`
7. `test-codemode-advanced-router-routes-part1.md`
8. `test-codemode-advanced-router-routes-part2.md`
9. `test-codemode-advanced-sandbox.md`
10. `test-codemode-advanced-schema-management.md`
11. `test-codemode-advanced-schema-routines.md`
12. `test-codemode-advanced-schema-triggers.md`
13. `test-codemode-advanced-schema-views-part1.md`
14. `test-codemode-advanced-schema-views-part2.md`
15. `test-codemode-advanced-security-audit-part1.md`
16. `test-codemode-advanced-security-audit-part2.md`
17. `test-codemode-advanced-security-system-part1.md`
18. `test-codemode-advanced-security-system-part2.md`
19. `test-codemode-advanced-sessions-part1.md`
20. `test-codemode-advanced-sessions-part2.md`
21. `test-codemode-advanced-shell-data-part1.md`
22. `test-codemode-advanced-shell-data-part2.md`
23. `test-codemode-advanced-shell-utils-part1a.md`
24. `test-codemode-advanced-shell-utils-part1b.md`
25. `test-codemode-advanced-shell-utils-part2.md`
26. `test-codemode-advanced-spatial-geometry.md`
27. `test-codemode-advanced-spatial-operations-part1.md`
28. `test-codemode-advanced-spatial-operations-part2.md`
29. `test-codemode-advanced-spatial-queries.md`
30. `test-codemode-advanced-spatial-setup.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

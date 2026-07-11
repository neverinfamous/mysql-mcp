# MySQL MCP Code Mode Testing - Phase 3: Schema & Security (Roles, Router, Schema, Security)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 21).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 3: Schema & Security (Roles, Router, Schema, Security))

1. `test-codemode-roles-grants.md`
2. `test-codemode-roles-management.md`
3. `test-codemode-router-core.md`
4. `test-codemode-router-routes-part1.md`
5. `test-codemode-router-routes-part2.md`
6. `test-codemode-schema-management-part1.md`
7. `test-codemode-schema-management-part2.md`
8. `test-codemode-schema-routines-part1.md`
9. `test-codemode-schema-routines-part2.md`
10. `test-codemode-security-audit.md`
11. `test-codemode-security-firewall-part1.md`
12. `test-codemode-security-firewall-part2.md`
13. `test-codemode-shell-data-part1a.md`
14. `test-codemode-shell-data-part1b.md`
15. `test-codemode-shell-data-part2a.md`
16. `test-codemode-shell-data-part2b.md`
17. `test-codemode-shell-utils.md`
18. `test-codemode-spatial-geometry.md`
19. `test-codemode-spatial-operations.md`
20. `test-codemode-spatial-queries-part1.md`
21. `test-codemode-spatial-queries-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

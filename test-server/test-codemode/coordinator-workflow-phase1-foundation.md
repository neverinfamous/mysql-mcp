# MySQL MCP Code Mode Testing - Phase 1: Foundation (Core, Admin, Cluster, Docstore)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 32).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation (Core, Admin, Cluster, Docstore))

1. `test-codemode-core-read-part1.md` (**MUST PASS FIRST**)
2. `test-codemode-core-read-part2.md`
3. `test-codemode-core-write-part1.md`
4. `test-codemode-core-write-part2.md`
5. `test-codemode-admin-audit.md`
6. `test-codemode-admin-maintenance-part1a.md`
7. `test-codemode-admin-maintenance-part1b.md`
8. `test-codemode-admin-maintenance-part2a.md`
9. `test-codemode-admin-maintenance-part2b.md`
10. `test-codemode-backup-audit.md`
11. `test-codemode-backup-data-part1.md`
12. `test-codemode-backup-data-part2.md`
13. `test-codemode-cluster-group-replication-part1.md`
14. `test-codemode-cluster-group-replication-part2.md`
15. `test-codemode-cluster-innodb-part1.md`
16. `test-codemode-cluster-innodb-part2.md`
17. `test-codemode-docstore-collections-part1.md`
18. `test-codemode-docstore-collections-part2.md`
19. `test-codemode-docstore-documents-part1.md`
20. `test-codemode-docstore-documents-part2.md`
21. `test-codemode-events-part1a.md`
22. `test-codemode-events-part1b.md`
23. `test-codemode-events-part2a.md`
24. `test-codemode-events-part2b.md`
25. `test-codemode-fulltext-part1a.md`
26. `test-codemode-fulltext-part1b.md`
27. `test-codemode-fulltext-part2a.md`
28. `test-codemode-fulltext-part2b.md`
29. `test-codemode-introspection-part1a.md`
30. `test-codemode-introspection-part1b.md`
31. `test-codemode-introspection-part2a.md`
32. `test-codemode-introspection-part2b.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

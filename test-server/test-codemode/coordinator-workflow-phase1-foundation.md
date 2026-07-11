# MySQL MCP Code Mode Testing - Phase 1: Foundation (Core, Admin, Cluster, Docstore)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 21).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation (Core, Admin, Cluster, Docstore))

1. `test-codemode-core-read.md` (**MUST PASS FIRST**)
2. `test-codemode-admin-audit.md`
3. `test-codemode-admin-maintenance-part1.md`
4. `test-codemode-admin-maintenance-part2.md`
5. `test-codemode-backup-audit.md`
6. `test-codemode-backup-data.md`
7. `test-codemode-cluster-group-replication-part1.md`
8. `test-codemode-cluster-group-replication-part2.md`
9. `test-codemode-cluster-innodb-part1.md`
10. `test-codemode-cluster-innodb-part2.md`
11. `test-codemode-core-write.md`
12. `test-codemode-docstore-collections-part1.md`
13. `test-codemode-docstore-collections-part2.md`
14. `test-codemode-docstore-documents.md`
15. `test-codemode-events-part1.md`
16. `test-codemode-events-part2.md`
17. `test-codemode-fulltext-part1a.md`
18. `test-codemode-fulltext-part1b.md`
19. `test-codemode-fulltext-part2.md`
20. `test-codemode-introspection-part1.md`
21. `test-codemode-introspection-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

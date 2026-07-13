# MySQL MCP Advanced Code Mode Testing - Phase 1: Foundation

> 🚀 **Core Features Tested:** Orchestrates deep validation of our advanced capabilities: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

We're working in the `mysql-mcp` project in this thread.

> **This document is optimized for an autonomous agent acting as a Coordinator.**

This guide instructs the Coordinator agent on how to run the `mysql-mcp` Advanced Code Mode test suite using subagents.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 28).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation)
1. `test-codemode-advanced-admin-control-part1.md` (**MUST PASS FIRST**)
2. `test-codemode-advanced-admin-control-part2.md`
3. `test-codemode-advanced-admin-maintenance-part1.md`
4. `test-codemode-advanced-admin-maintenance-part2.md`
5. `test-codemode-advanced-backup-audit-part1.md`
6. `test-codemode-advanced-backup-audit-part2.md`
7. `test-codemode-advanced-backup-export-part1.md`
8. `test-codemode-advanced-backup-export-part2.md`
9. `test-codemode-advanced-cluster-group-replication-part1.md`
10. `test-codemode-advanced-cluster-group-replication-part2.md`
11. `test-codemode-advanced-cluster-innodb-part1.md`
12. `test-codemode-advanced-cluster-innodb-part2.md`
13. `test-codemode-advanced-concurrency.md`
14. `test-codemode-advanced-core-part1a.md`
15. `test-codemode-advanced-core-part1b.md`
16. `test-codemode-advanced-core-part2a.md`
17. `test-codemode-advanced-core-part3a.md`
18. `test-codemode-advanced-core-part3b.md`
19. `test-codemode-advanced-docstore-collections-part1.md`
20. `test-codemode-advanced-docstore-collections-part2.md`
21. `test-codemode-advanced-docstore-documents-part1.md`
22. `test-codemode-advanced-docstore-documents-part2.md`
23. `test-codemode-advanced-events-part1.md`
24. `test-codemode-advanced-events-part2.md`
25. `test-codemode-advanced-fulltext-part1.md`
26. `test-codemode-advanced-fulltext-part2.md`
27. `test-codemode-advanced-introspection-part1.md`
28. `test-codemode-advanced-introspection-part2.md`


## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

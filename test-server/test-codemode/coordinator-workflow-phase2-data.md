# MySQL MCP Code Mode Testing - Phase 2: Data & Performance (JSON, Migration, Perf, Rep)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 21).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 2: Data & Performance (JSON, Migration, Perf, Rep))

1. `test-codemode-json-core-read.md`
2. `test-codemode-json-core-write-part1.md`
3. `test-codemode-json-core-write-part2.md`
4. `test-codemode-json-enhanced-part1.md`
5. `test-codemode-json-enhanced-part2.md`
6. `test-codemode-json-helpers.md`
7. `test-codemode-migration-part1.md`
8. `test-codemode-migration-part2.md`
9. `test-codemode-monitoring-part1.md`
10. `test-codemode-monitoring-part2.md`
11. `test-codemode-optimization-part1.md`
12. `test-codemode-optimization-part2.md`
13. `test-codemode-partitioning.md`
14. `test-codemode-performance-analysis-queries.md`
15. `test-codemode-performance-analysis-system.md`
16. `test-codemode-performance-anomaly.md`
17. `test-codemode-proxysql-config.md`
18. `test-codemode-proxysql-status-part1.md`
19. `test-codemode-proxysql-status-part2.md`
20. `test-codemode-replication-part1.md`
21. `test-codemode-replication-part2.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

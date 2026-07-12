# MySQL MCP Usability Testing - Phase 4: Analytics & Advanced

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 43).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: Analytics & Advanced)

- [test-usability-optimization-part1.md](test-usability-optimization-part1.md)
- [test-usability-optimization-part2.md](test-usability-optimization-part2.md)
- [test-usability-fulltext-part1.md](test-usability-fulltext-part1.md)
- [test-usability-fulltext-part2.md](test-usability-fulltext-part2.md)
- [test-usability-events-part1.md](test-usability-events-part1.md)
- [test-usability-events-part2.md](test-usability-events-part2.md)
- [test-usability-sysschema-part1.md](test-usability-sysschema-part1.md)
- [test-usability-sysschema-part2.md](test-usability-sysschema-part2.md)
- [test-usability-sysschema-part3.md](test-usability-sysschema-part3.md)
- [test-usability-spatial-part1.md](test-usability-spatial-part1.md)
- [test-usability-spatial-part2.md](test-usability-spatial-part2.md)
- [test-usability-spatial-part3.md](test-usability-spatial-part3.md)
- [test-usability-spatial-part4.md](test-usability-spatial-part4.md)
- [test-usability-security-part1.md](test-usability-security-part1.md)
- [test-usability-security-part2.md](test-usability-security-part2.md)
- [test-usability-security-part3.md](test-usability-security-part3.md)
- [test-usability-cluster-part1.md](test-usability-cluster-part1.md)
- [test-usability-cluster-part2.md](test-usability-cluster-part2.md)
- [test-usability-cluster-part3.md](test-usability-cluster-part3.md)
- [test-usability-cluster-part4.md](test-usability-cluster-part4.md)
- [test-usability-roles-part1.md](test-usability-roles-part1.md)
- [test-usability-roles-part2.md](test-usability-roles-part2.md)
- [test-usability-roles-part3.md](test-usability-roles-part3.md)
- [test-usability-docstore-part1.md](test-usability-docstore-part1.md)
- [test-usability-docstore-part2.md](test-usability-docstore-part2.md)
- [test-usability-docstore-part3.md](test-usability-docstore-part3.md)
- [test-usability-vector-part1.md](test-usability-vector-part1.md)
- [test-usability-vector-part2.md](test-usability-vector-part2.md)
- [test-usability-vector-part3.md](test-usability-vector-part3.md)
- [test-usability-vector-part4.md](test-usability-vector-part4.md)
- [test-usability-replication-part1.md](test-usability-replication-part1.md)
- [test-usability-replication-part2.md](test-usability-replication-part2.md)
- [test-usability-router-part1.md](test-usability-router-part1.md)
- [test-usability-router-part2.md](test-usability-router-part2.md)
- [test-usability-router-part3.md](test-usability-router-part3.md)
- [test-usability-proxysql-part1.md](test-usability-proxysql-part1.md)
- [test-usability-proxysql-part2.md](test-usability-proxysql-part2.md)
- [test-usability-proxysql-part3.md](test-usability-proxysql-part3.md)
- [test-usability-proxysql-part4.md](test-usability-proxysql-part4.md)
- [test-usability-shell-part1.md](test-usability-shell-part1.md)
- [test-usability-shell-part2.md](test-usability-shell-part2.md)
- [test-usability-shell-part3.md](test-usability-shell-part3.md)
- [test-usability-shell-part4.md](test-usability-shell-part4.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

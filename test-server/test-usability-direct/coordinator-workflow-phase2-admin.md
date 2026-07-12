# MySQL MCP Direct Usability Testing - Phase 2: Admin & Performance

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 16).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 2: Admin & Performance)

- [test-usability-direct-admin-part1.md](test-usability-direct-admin-part1.md)
- [test-usability-direct-admin-part2.md](test-usability-direct-admin-part2.md)
- [test-usability-direct-admin-part3.md](test-usability-direct-admin-part3.md)
- [test-usability-direct-performance-part1.md](test-usability-direct-performance-part1.md)
- [test-usability-direct-performance-part2.md](test-usability-direct-performance-part2.md)
- [test-usability-direct-performance-part3.md](test-usability-direct-performance-part3.md)
- [test-usability-direct-performance-part4.md](test-usability-direct-performance-part4.md)
- [test-usability-direct-monitoring-part1.md](test-usability-direct-monitoring-part1.md)
- [test-usability-direct-monitoring-part2.md](test-usability-direct-monitoring-part2.md)
- [test-usability-direct-monitoring-part3.md](test-usability-direct-monitoring-part3.md)
- [test-usability-direct-backup-part1.md](test-usability-direct-backup-part1.md)
- [test-usability-direct-backup-part2.md](test-usability-direct-backup-part2.md)
- [test-usability-direct-backup-part3.md](test-usability-direct-backup-part3.md)
- [test-usability-direct-transactions-part1.md](test-usability-direct-transactions-part1.md)
- [test-usability-direct-transactions-part2.md](test-usability-direct-transactions-part2.md)
- [test-usability-direct-transactions-part3.md](test-usability-direct-transactions-part3.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

# MySQL MCP Usability Testing - Phase 3: Schema & Stats

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 17).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 3: Schema & Stats)

- [test-usability-schema-part1.md](test-usability-schema-part1.md)
- [test-usability-schema-part2.md](test-usability-schema-part2.md)
- [test-usability-schema-part3.md](test-usability-schema-part3.md)
- [test-usability-schema-part4.md](test-usability-schema-part4.md)
- [test-usability-stats-part1.md](test-usability-stats-part1.md)
- [test-usability-stats-part2.md](test-usability-stats-part2.md)
- [test-usability-stats-part3.md](test-usability-stats-part3.md)
- [test-usability-stats-part4.md](test-usability-stats-part4.md)
- [test-usability-stats-part5.md](test-usability-stats-part5.md)
- [test-usability-stats-part6.md](test-usability-stats-part6.md)
- [test-usability-stats-part7.md](test-usability-stats-part7.md)
- [test-usability-introspection-part1.md](test-usability-introspection-part1.md)
- [test-usability-introspection-part2.md](test-usability-introspection-part2.md)
- [test-usability-migration-part1.md](test-usability-migration-part1.md)
- [test-usability-migration-part2.md](test-usability-migration-part2.md)
- [test-usability-partitioning-part1.md](test-usability-partitioning-part1.md)
- [test-usability-partitioning-part2.md](test-usability-partitioning-part2.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

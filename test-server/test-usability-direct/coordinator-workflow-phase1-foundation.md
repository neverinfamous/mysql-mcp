# MySQL MCP Direct Usability Testing - Phase 1: Foundation (Core, JSON, Text)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Fails" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL FAILS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 13).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 1: Foundation (Core, JSON, Text))

- [test-usability-direct-core-part1.md](test-usability-direct-core-part1.md)
- [test-usability-direct-core-part2.md](test-usability-direct-core-part2.md)
- [test-usability-direct-core-part3.md](test-usability-direct-core-part3.md)
- [test-usability-direct-core-part4.md](test-usability-direct-core-part4.md)
- [test-usability-direct-json-part1.md](test-usability-direct-json-part1.md)
- [test-usability-direct-json-part2.md](test-usability-direct-json-part2.md)
- [test-usability-direct-json-part3.md](test-usability-direct-json-part3.md)
- [test-usability-direct-json-part4.md](test-usability-direct-json-part4.md)
- [test-usability-direct-json-part5.md](test-usability-direct-json-part5.md)
- [test-usability-direct-json-part6.md](test-usability-direct-json-part6.md)
- [test-usability-direct-text-part1.md](test-usability-direct-text-part1.md)
- [test-usability-direct-text-part2.md](test-usability-direct-text-part2.md)
- [test-usability-direct-codemode.md](test-usability-direct-codemode.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

# MySQL MCP Tool Groups Testing - Phase 4 (ai-data-nosql)

> **This is a sharded workflow phase.** The main test suite has been split into phases to prevent context window exhaustion.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).
- Ensure the user has started the server with the `ai-data-nosql` shortcut filter.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt / B Code / C Graceful Fails" (Where Y is 3).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: `ai-data-nosql`)

- `test-docstore-part1.md`
- `test-docstore-part2.md`
- `test-docstore-part3.md`

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to:
1. Switch the shortcut to the next phase's shortcut.
2. Restart the server.
3. Start a NEW thread passing the next phase's markdown file.

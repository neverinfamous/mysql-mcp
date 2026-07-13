# MySQL MCP Usability Test Phase: admin

We're working in the `mysql-mcp` project in this thread.

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 7).
- Terminate subagents when done to save context.

## Tasks

- [ ] [test-usability-admin-part1.md](test-usability-admin-part1.md)
- [ ] [test-usability-admin-part2.md](test-usability-admin-part2.md)
- [ ] [test-usability-admin-part3.md](test-usability-admin-part3.md)
- [ ] [test-usability-performance-part1.md](test-usability-performance-part1.md)
- [ ] [test-usability-performance-part2.md](test-usability-performance-part2.md)
- [ ] [test-usability-performance-part3.md](test-usability-performance-part3.md)
- [ ] [test-usability-performance-part4.md](test-usability-performance-part4.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

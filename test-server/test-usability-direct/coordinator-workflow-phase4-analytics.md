# MySQL MCP Direct Usability Test Phase: analytics

## Execution Rules
Follow the exact same workflow rules defined in the [Master Coordinator Index](coordinator-workflow.md).

- **CRITICAL WARNING FOR SUBAGENTS:** Do NOT run `pnpm run test`, `pnpm run check`, or `pnpm run build` after making changes to save time (15-20 mins). Only run `pnpm run lint` and `pnpm run typecheck`. The main coordinator agent will run the full test suite at the end of the phase.
- **CRITICAL WARNING FOR SUBAGENTS:** "Graceful Degradations" refers ONLY to tests that could NOT be completed due to a temporary system problem or tool limitation. SUCCESSFUL NEGATIVE TESTS MUST NEVER BE COUNTED AS GRACEFUL DEGRADATIONS.
- Execute these tests sequentially.
- Launch a subagent for each test.
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 43).
- Terminate subagents when done to save context.

## Tasks

- [test-usability-direct-fulltext-part1.md](test-usability-direct-fulltext-part1.md)
- [test-usability-direct-fulltext-part2.md](test-usability-direct-fulltext-part2.md)
- [test-usability-direct-optimization-part1.md](test-usability-direct-optimization-part1.md)
- [test-usability-direct-optimization-part2.md](test-usability-direct-optimization-part2.md)
- [test-usability-direct-replication-part1.md](test-usability-direct-replication-part1.md)
- [test-usability-direct-replication-part2.md](test-usability-direct-replication-part2.md)
- [test-usability-direct-router-part1.md](test-usability-direct-router-part1.md)
- [test-usability-direct-router-part2.md](test-usability-direct-router-part2.md)
- [test-usability-direct-router-part3.md](test-usability-direct-router-part3.md)
- [test-usability-direct-proxysql-part1.md](test-usability-direct-proxysql-part1.md)
- [test-usability-direct-proxysql-part2.md](test-usability-direct-proxysql-part2.md)
- [test-usability-direct-proxysql-part3.md](test-usability-direct-proxysql-part3.md)
- [test-usability-direct-proxysql-part4.md](test-usability-direct-proxysql-part4.md)
- [test-usability-direct-shell-part1.md](test-usability-direct-shell-part1.md)
- [test-usability-direct-shell-part2.md](test-usability-direct-shell-part2.md)
- [test-usability-direct-shell-part3.md](test-usability-direct-shell-part3.md)
- [test-usability-direct-shell-part4.md](test-usability-direct-shell-part4.md)
- [test-usability-direct-events-part1.md](test-usability-direct-events-part1.md)
- [test-usability-direct-events-part2.md](test-usability-direct-events-part2.md)
- [test-usability-direct-sysschema-part1.md](test-usability-direct-sysschema-part1.md)
- [test-usability-direct-sysschema-part2.md](test-usability-direct-sysschema-part2.md)
- [test-usability-direct-sysschema-part3.md](test-usability-direct-sysschema-part3.md)
- [test-usability-direct-spatial-part1.md](test-usability-direct-spatial-part1.md)
- [test-usability-direct-spatial-part2.md](test-usability-direct-spatial-part2.md)
- [test-usability-direct-spatial-part3.md](test-usability-direct-spatial-part3.md)
- [test-usability-direct-spatial-part4.md](test-usability-direct-spatial-part4.md)
- [test-usability-direct-security-part1.md](test-usability-direct-security-part1.md)
- [test-usability-direct-security-part2.md](test-usability-direct-security-part2.md)
- [test-usability-direct-security-part3.md](test-usability-direct-security-part3.md)
- [test-usability-direct-cluster-part1.md](test-usability-direct-cluster-part1.md)
- [test-usability-direct-cluster-part2.md](test-usability-direct-cluster-part2.md)
- [test-usability-direct-cluster-part3.md](test-usability-direct-cluster-part3.md)
- [test-usability-direct-cluster-part4.md](test-usability-direct-cluster-part4.md)
- [test-usability-direct-roles-part1.md](test-usability-direct-roles-part1.md)
- [test-usability-direct-roles-part2.md](test-usability-direct-roles-part2.md)
- [test-usability-direct-roles-part3.md](test-usability-direct-roles-part3.md)
- [test-usability-direct-docstore-part1.md](test-usability-direct-docstore-part1.md)
- [test-usability-direct-docstore-part2.md](test-usability-direct-docstore-part2.md)
- [test-usability-direct-docstore-part3.md](test-usability-direct-docstore-part3.md)
- [test-usability-direct-vector-part1.md](test-usability-direct-vector-part1.md)
- [test-usability-direct-vector-part2.md](test-usability-direct-vector-part2.md)
- [test-usability-direct-vector-part3.md](test-usability-direct-vector-part3.md)
- [test-usability-direct-vector-part4.md](test-usability-direct-vector-part4.md)

## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

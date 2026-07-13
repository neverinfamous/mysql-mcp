# MySQL MCP Advanced Code Mode Testing - Phase 2: Performance

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
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 27).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 2: Performance)

29. `test-codemode-advanced-json-core-part1a.md`
30. `test-codemode-advanced-json-core-part1b.md`
31. `test-codemode-advanced-json-core-part2a.md`
32. `test-codemode-advanced-json-core-part2b.md`
33. `test-codemode-advanced-json-enhanced-part1.md`
34. `test-codemode-advanced-json-enhanced-part2.md`
35. `test-codemode-advanced-json-helpers.md`
36. `test-codemode-advanced-migration-part1.md`
37. `test-codemode-advanced-migration-part2.md`
38. `test-codemode-advanced-monitoring-health-part1.md`
39. `test-codemode-advanced-monitoring-health-part2.md`
40. `test-codemode-advanced-monitoring-status.md`
41. `test-codemode-advanced-optimization-part1.md`
42. `test-codemode-advanced-optimization-part2.md`
43. `test-codemode-advanced-partitioning-part1.md`
44. `test-codemode-advanced-partitioning-part2.md`
45. `test-codemode-advanced-performance-analysis-part1a.md`
46. `test-codemode-advanced-performance-analysis-part1b.md`
47. `test-codemode-advanced-performance-analysis-part2a.md`
48. `test-codemode-advanced-performance-analysis-part2b.md`
49. `test-codemode-advanced-performance-anomaly.md`
50. `test-codemode-advanced-proxysql-config-part1.md`
51. `test-codemode-advanced-proxysql-config-part2.md`
52. `test-codemode-advanced-proxysql-status-part1.md`
53. `test-codemode-advanced-proxysql-status-part2.md`
54. `test-codemode-advanced-replication-part1.md`
55. `test-codemode-advanced-replication-part2.md`


## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

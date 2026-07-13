# MySQL MCP Advanced Code Mode Testing - Phase 3: Security

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
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 30).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 3: Security)

56. `test-codemode-advanced-roles-assignment-part1.md`
57. `test-codemode-advanced-roles-assignment-part2.md`
58. `test-codemode-advanced-roles-management-part1.md`
59. `test-codemode-advanced-roles-management-part2.md`
60. `test-codemode-advanced-router-advanced-part1.md`
61. `test-codemode-advanced-router-advanced-part2.md`
62. `test-codemode-advanced-router-routes-part1.md`
63. `test-codemode-advanced-router-routes-part2.md`
64. `test-codemode-advanced-sandbox.md`
65. `test-codemode-advanced-schema-management.md`
66. `test-codemode-advanced-schema-routines.md`
67. `test-codemode-advanced-schema-triggers.md`
68. `test-codemode-advanced-schema-views-part1.md`
69. `test-codemode-advanced-schema-views-part2.md`
70. `test-codemode-advanced-security-audit-part1.md`
71. `test-codemode-advanced-security-audit-part2.md`
72. `test-codemode-advanced-security-system-part1.md`
73. `test-codemode-advanced-security-system-part2.md`
74. `test-codemode-advanced-sessions-part1.md`
75. `test-codemode-advanced-sessions-part2.md`
76. `test-codemode-advanced-shell-data-part1.md`
77. `test-codemode-advanced-shell-data-part2.md`
78. `test-codemode-advanced-shell-utils-part1a.md`
79. `test-codemode-advanced-shell-utils-part1b.md`
80. `test-codemode-advanced-shell-utils-part2.md`
81. `test-codemode-advanced-spatial-geometry.md`
82. `test-codemode-advanced-spatial-operations-part1.md`
83. `test-codemode-advanced-spatial-operations-part2.md`
84. `test-codemode-advanced-spatial-queries.md`
85. `test-codemode-advanced-spatial-setup.md`


## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

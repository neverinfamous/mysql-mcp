# MySQL MCP Advanced Code Mode Testing - Phase 4: Analytics

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
- Report progress exactly as formatted: "Test X (<name>) out of Y: A Prompt Fixes / B Code Fixes / C Graceful Degradations" (Where Y is 26).
- Terminate subagents when done to save context.

## Test Sequence Queue (Phase 4: Analytics)

86. `test-codemode-advanced-stats-advanced-part1.md`
87. `test-codemode-advanced-stats-advanced-part2.md`
88. `test-codemode-advanced-stats-descriptive-part1.md`
89. `test-codemode-advanced-stats-descriptive-part2.md`
90. `test-codemode-advanced-stats-time-series-part1.md`
91. `test-codemode-advanced-stats-time-series-part2.md`
92. `test-codemode-advanced-stats-window-part1.md`
93. `test-codemode-advanced-stats-window-part2.md`
94. `test-codemode-advanced-sys-part1a.md`
95. `test-codemode-advanced-sys-part1b.md`
96. `test-codemode-advanced-sys-part2a.md`
97. `test-codemode-advanced-sys-part2b.md`
98. `test-codemode-advanced-text-part1.md`
99. `test-codemode-advanced-text-part2.md`
100. `test-codemode-advanced-transactions-part1a.md`
101. `test-codemode-advanced-transactions-part1b.md`
102. `test-codemode-advanced-transactions-part2.md`
103. `test-codemode-advanced-types-binary.md`
104. `test-codemode-advanced-types-date.md`
105. `test-codemode-advanced-types-json.md`
106. `test-codemode-advanced-types-numeric.md`
107. `test-codemode-advanced-vector-management-part1.md`
108. `test-codemode-advanced-vector-management-part2.md`
109. `test-codemode-advanced-vector-search-part1.md`
110. `test-codemode-advanced-vector-search-part2.md`
111. `test-codemode-advanced-vector-storage.md`


## Completion
Once this phase is complete, run the standard `pnpm run` checks, ensure everything is committed, and instruct the user to proceed to the next phase in a NEW thread.

# MySQL-MCP Code Mode Testing Suite

**Directory Purpose**: This folder contains 28 self-contained, modular test prompts covering every tool group in `mysql-mcp`. These prompts are strictly designed for **Code Mode (`mysql_execute_code`) validation only**.

## Agent Instructions

When tasked with running tests from this folder, adhere to the following optimized protocol:

### 1. Execution Strictness

- **Code Mode Exclusive**: Test tools ONLY using `mysql_execute_code`. Do not use the terminal or standalone standard tools unless specifically requested.
- **Batching**: Group multiple method calls into a single JavaScript code execution script to save context window tokens and improve speed.
- **Failures Array Format**: Design your JS script to capture both expected outputs and caught errors, appending assertions to a `failures` array, and returning `{ failures, success: failures.length === 0 }`.

### 2. Validation Targets

- **Happy Path Parity**: Validate that Code Mode handler execution matches expected database behavior.
- **Structured Error Path**: Ensure domain errors (e.g. nonexistent table) return an object `{"success": false, "error": "..."}` instead of crashing or leaking raw MCP errors.
- **Zod Resilience**: Pass `{}` missing required parameters or invalid types, and verify that Zod errors are properly caught and formatted, rather than returning raw JSON arrays.
- **Payload Limits**: If a response payload is excessively large, report it as a 📦 Payload issue to optimize token usage.

### 3. Tracking Progress

`| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |`
Never proceed to the final step until every tool in a given group has both columns marked as ✅.

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for tracking progress and testing results. DO NOT modify the testing prompt files directly.

### 4. Cleanup

- Any write tests should operate on temporary tables or objects prefixed with `temp_` (e.g., `temp_users`).
- Your script should explicitly drop `temp_` objects at the end of execution.

## Tool Groups Available

1. `admin` (6 tools)
2. `backup` (4 tools)
3. `cluster` (10 tools)
4. `core` (8 tools)
5. `document` (9 tools)
6. `events` (6 tools)
7. `fulltext` (5 tools)
8. `introspection` (6 tools)
9. `json` (17 tools)
10. `migration` (6 tools)
11. `monitoring` (7 tools)
12. `optimization` (4 tools)
13. `partitioning` (4 tools)
14. `performance` (11 tools)
15. `proxysql` (11 tools)
16. `replication` (5 tools)
17. `roles` (8 tools)
18. `router` (9 tools)
19. `schema` (11 tools)
20. `security` (9 tools)
21. `shell` (10 tools)
22. `spatial` (12 tools)
23. `stats` (20 tools)
24. `sys` (8 tools)
25. `text` (6 tools)
26. `transactions` (7 tools)

Execute these sequentially, updating the Changelog and resolving bugs systematically before moving to the next.

## Test Results

Token consumption metrics and final summaries from executing the above codemode tests are persisted in [`test-results.md`](./test-results.md).

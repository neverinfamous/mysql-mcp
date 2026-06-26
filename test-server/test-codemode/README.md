# MySQL-MCP Code Mode Testing Suite


**Directory Purpose**: This folder contains 29 self-contained, modular test prompts covering every tool group in `mysql-mcp`. These prompts are strictly designed for **Code Mode (`mysql_execute_code`) validation only**.

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
- **Sandbox Boundaries**: Ensure the server is configured with an `ALLOWED_IO_ROOTS` environment variable (e.g., `ALLOWED_IO_ROOTS=/tmp`). When testing filesystem-interacting tools (`backup`, `shell`), deliberately attempt directory traversal (e.g., `../..`) and provide paths outside the allowed roots. Assert that the operation is blocked and returns a structured `SECURITY_ERROR` rather than a raw exception.

### 3. Tracking Progress

`| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |`
Never proceed to the final step until every tool in a given group has both columns marked as ✅.

> **Help Resources**: The server uses an Adaptive Instruction Architecture. The `mysql.*` API signatures are NOT injected into your prompt by default. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/schema`) before writing code to understand the expected methods and parameters.

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for tracking progress and testing results. DO NOT modify the testing prompt files directly.

### 4. Cleanup

- Any write tests should operate on temporary tables or objects prefixed with `temp_` (e.g., `temp_users`).
- Your script should explicitly drop `temp_` objects at the end of execution.

## Tool Groups Available

1. `admin`
2. `backup`
3. `cluster-group-replication`
4. `cluster-innodb`
5. `core`
6. `docstore`
7. `events`
8. `fulltext`
9. `introspection`
10. `json-core`
11. `json-enhanced`
12. `json-helpers`
13. `migration`
14. `monitoring`
15. `optimization`
16. `partitioning`
17. `performance-analysis`
18. `performance-anomaly`
19. `proxysql-config`
20. `proxysql-status`
21. `replication`
22. `roles`
23. `router`
24. `schema-management`
25. `schema-routines`
26. `security`
27. `shell-data`
28. `shell-utils`
29. `spatial-geometry`
30. `spatial-operations`
31. `spatial-queries`
32. `spatial-setup`
33. `stats-advanced`
34. `stats-descriptive`
35. `stats-window`
36. `sys`
37. `text`
38. `transactions`
39. `vector-management`
40. `vector-search`
41. `vector-storage`
42. `versioning`

## Test Results

Token consumption metrics and final summaries from executing the above codemode tests are persisted in [`test-results.md`](./test-results.md).

# MySQL-MCP Standard Testing Suite

**Directory Purpose**: This folder contains 28 self-contained, modular test prompts covering every tool group in `mysql-mcp`. These prompts are strictly designed for **Direct MCP Tool Call validation**.

## Agent Instructions

When tasked with running tests from this folder, adhere to the following optimized protocol:

### 1. Execution Strictness

- **Direct Calls Exclusive**: Test tools ONLY using direct MCP tool calls (e.g., calling `mysql_analyze_table`). Do not use Code Mode (`mysql_execute_code`) or scripts to batch the tests.
- **No Scripted Loops**: Each happy and error path must be tested individually with a distinct tool call. This simulates exact client interaction behavior.

### 2. Validation Targets

- **Happy Path Consistency**: Validate that each tool outputs exactly what is expected from the explicit checklist items given in the prompt.
- **Structured Error Path (P154)**: Ensure domain errors (e.g., nonexistent table) return an object `{"success": false, "error": "..."}`. A raw MCP error indicates a missing try/catch in the handler.
- **Zod Exceptions**: Pass `{}` missing required parameters or invalid types. The error string must not be a raw JSON array but must be cleaned up by the handler's error formatter.
- **Payload Limits**: Watch for payload bloat and explicitly log it as a 📦 warning if it risks overflowing context window token limits.
- **Sandbox Boundaries**: Ensure the server is configured with an `ALLOWED_IO_ROOTS` environment variable (e.g., `ALLOWED_IO_ROOTS=/tmp`). When testing filesystem-interacting tools (`backup`, `shell`), deliberately attempt directory traversal (e.g., `../..`) and provide paths outside the allowed roots. Assert that the operation is blocked and returns a structured `SECURITY_ERROR` rather than a raw exception.

### 3. Tracking Metrics & Progress

- **Scratchpad**: Use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify the testing prompt files directly unless there is an error in them.
- `| Tool | Direct Call (Happy Path) | Domain Error | Zod Empty Param | Alias Acceptance |`
  Never proceed to the final step until every tool in a given group is fully checked off.
- **Help Resources**: The server uses an Adaptive Instruction Architecture. Tool signatures are NOT injected into your prompt by default. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/schema`) before testing to understand the expected parameters.
- **Session Token Usage**: Use `read_resource` on `mysql://audit` at the end of your test group to capture the total `sessionTokenEstimate` and log it in your summaries.

### 4. Cleanup & Scope

- Direct write tests should operate on temporary tables or objects prefixed with `temp_`.
- When completed, explicitly drop all `temp_` artifacts.
- Update `../code-map.md`, handlers, and instructions if bugs are uncovered, then update the Changelog with fixes before summarizing your work.

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

## Execution

Begin with any requested group prompt from this folder (e.g. `test-tool-group-admin.md`), and execute the deterministic checklist line-by-line using direct tool calls only.

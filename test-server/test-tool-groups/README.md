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

### 3. Tracking Metrics & Progress

- **Scratchpad**: Use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify the testing prompt files directly unless there is an error in them.
-   `| Tool | Direct Call (Happy Path) | Domain Error | Zod Empty Param | Alias Acceptance |`
  Never proceed to the final step until every tool in a given group is fully checked off.
- **Session Token Usage**: Use `read_resource` on `mysql://audit` at the end of your test group to capture the total `sessionTokenEstimate` and log it in your summaries.

### 4. Cleanup & Scope

- Direct write tests should operate on temporary tables or objects prefixed with `temp_`.
- When completed, explicitly drop all `temp_` artifacts.
- Update `../code-map.md`, handlers, and instructions if bugs are uncovered, then update the Changelog with fixes before summarizing your work.

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
19. `schema` (10 tools)
20. `security` (9 tools)
21. `shell` (10 tools)
22. `spatial` (12 tools)
23. `stats` (20 tools)
24. `sys` (8 tools)
25. `text` (6 tools)
26. `transactions` (7 tools)

## Execution

Begin with any requested group prompt from this folder (e.g. `test-tool-group-admin.md`), and execute the deterministic checklist line-by-line using direct tool calls only.

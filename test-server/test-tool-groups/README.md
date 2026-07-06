# MySQL-MCP Standard Testing Suite

[![Tools](https://img.shields.io/badge/Tools-200%2B-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-23-green?style=for-the-badge)](#)
[![Test Prompts](https://img.shields.io/badge/Test%20Prompts-57-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

## Value Proposition

- **Build AI integrations instantly.**
- **Empower agents with secure database access.**
- **Execute complex logic via Code Mode.**
- **Scale operations with robust connection pooling.**
- **Leverage OAuth 2.1 for enterprise security.**

> 🚀 **Core Features Tested:** Validate standard MCP capabilities and ensure compatibility with enterprise-grade **OAuth 2.1**, **Direct Tool Calls**, and **Connection Pooling**.

**Directory Purpose**: This folder contains 57 modular test prompts covering every tool group. These prompts are strictly designed for direct MCP tool call validation.

## Follow Agent Instructions

When tasked with running tests from this folder, adhere to the following optimized protocol:

### Enable Anti-Hallucination Guardrails
- **Strict Parsing**: Read exact filenames from `coordinator-workflow.md`. Cross-reference them with a live `list_dir`. Subagents MUST output `STATUS: SUCCESS` or `STATUS: FAILED_FILE_NOT_FOUND`. Halt immediately if a file is missing.
- **Checklist Integrity**: Take extreme care when updating statuses in `task.md`. Modify completion brackets only. Never alter or abbreviate filename strings.

### Enforce Execution Strictness

- **Direct Calls Exclusive**: Test tools ONLY using direct MCP tool calls (e.g., calling `mysql_analyze_table`). Do not use Code Mode (`mysql_execute_code`) or scripts to batch the tests.
- **No Scripted Loops**: Each happy and error path must be tested individually with a distinct tool call. This simulates exact client interaction behavior.

### Verify Validation Targets

- **Happy Path Consistency**: Validate that each tool outputs exactly what is expected from the explicit checklist items given in the prompt.
- **Structured Error Path (P154)**: Ensure domain errors (e.g., nonexistent table) return an object `{"success": false, "error": "..."}`. A raw MCP error indicates a missing try/catch in the handler.
- **Zod Exceptions**: Pass `{}` missing required parameters or invalid types. The error string must not be a raw JSON array but must be cleaned up by the handler's error formatter.
- **Payload Limits**: Watch for payload bloat and explicitly log it as a 📦 warning if it risks overflowing context window token limits.
- **Sandbox Boundaries**: Ensure the server is configured with an `ALLOWED_IO_ROOTS` environment variable (e.g., `ALLOWED_IO_ROOTS=/tmp`). When testing filesystem-interacting tools (`backup`, `shell`), deliberately attempt directory traversal (e.g., `../..`) and provide paths outside the allowed roots. Assert that the operation is blocked and returns a structured `SECURITY_ERROR` rather than a raw exception.

### Track Metrics and Progress

- **Scratchpad**: Use `<appDataDir>\brain\<conversation-id>\scratch\task.md` as your scratchpad for testing and reporting results. DO NOT modify the testing prompt files directly unless there is an error in them.
- `| Tool | Direct Call (Happy Path) | Domain Error | Zod Empty Param | Alias Acceptance |`
  Never proceed to the final step until every tool in a given group is fully checked off.
- **Help Resources**: The server uses an Adaptive Instruction Architecture. Tool signatures are NOT injected into your prompt by default. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/schema`) before testing to understand the expected parameters.
- **Session Token Usage**: Use `read_resource` on `mysql://metrics` at the end of your test group to capture the total `sessionTokenEstimate` and log it in your summaries.

### Perform Cleanup

- Direct write tests should operate on temporary tables or objects prefixed with `temp_`.
- When completed, explicitly drop all `temp_` artifacts.
- Update `../code-map.md`, handlers, and instructions if bugs are uncovered, then summarize your work.

## Access Available Test Files

> **Note**: These files are standard prompt outlines intended to be fed directly to subagents for parallel execution.

- `test-admin-part1.md`
- `test-admin-part2.md`
- `test-backup-part1.md`
- `test-backup-part2.md`
- `test-cluster-gr.md`
- `test-cluster-innodb.md`
- `test-codemode.md`
- `test-core-part1.md`
- `test-core-part2.md`
- `test-docstore-part1.md`
- `test-docstore-part2.md`
- `test-events.md`
- `test-fulltext-part1.md`
- `test-fulltext-part2.md`
- `test-introspection.md`
- `test-json-core-part1.md`
- `test-json-core-part2.md`
- `test-json-enhanced.md`
- `test-json-helpers.md`
- `test-migration.md`
- `test-monitoring.md`
- `test-optimization.md`
- `test-partitioning.md`
- `test-performance-analysis-part1.md`
- `test-performance-analysis-part2.md`
- `test-performance-anomaly.md`
- `test-proxysql-part1.md`
- `test-proxysql-part2.md`
- `test-replication.md`
- `test-roles-part1.md`
- `test-roles-part2.md`
- `test-router-part1.md`
- `test-router-part2.md`
- `test-schema-management.md`
- `test-schema-routines-part1.md`
- `test-schema-routines-part2.md`
- `test-security-part1.md`
- `test-security-part2.md`
- `test-shell-part1.md`
- `test-shell-part2.md`
- `test-spatial-geometry.md`
- `test-spatial-operations.md`
- `test-spatial-queries.md`
- `test-spatial-setup.md`
- `test-stats-advanced.md`
- `test-stats-descriptive-part1.md`
- `test-stats-descriptive-part2.md`
- `test-stats-window.md`
- `test-sys-part1.md`
- `test-sys-part2.md`
- `test-text.md`
- `test-transactions.md`
- `test-vector-management.md`
- `test-vector-search.md`
- `test-vector-storage.md`
- `test-versioning-part1.md`
- `test-versioning-part2.md`

## Begin Execution

Begin with any requested group prompt from this folder (e.g. `test-admin-part1.md`), and execute the deterministic checklist line-by-line using direct tool calls only.

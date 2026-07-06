# MySQL-MCP Code Mode Testing Suite

[![Tools](https://img.shields.io/badge/Tools-241-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-23-green?style=for-the-badge)](#)
[![Prompts](https://img.shields.io/badge/Prompts-19-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

## Value Proposition

- **Build AI integrations instantly.**
- **Empower agents with secure database access.**
- **Execute complex logic via Code Mode.**
- **Scale operations with robust connection pooling.**
- **Leverage OAuth 2.1 for enterprise security.**

**Directory Purpose**: This folder contains 53 modular test prompts. They cover every tool group in `mysql-mcp`. These prompts validate Code Mode (`mysql_execute_code`) only.

> 🚀 **Core Features Tested:** This suite rigorously validates our fastest and most capable execution environment: **Code Mode**, along with our secure **OAuth 2.1** and robust **Docker**.

## Follow Agent Instructions

When tasked with running tests from this folder, adhere to the following optimized protocol:

### Enable Anti-Hallucination Guardrails
- **Strict Parsing**: Read exact filenames from `coordinator-workflow.md`. Cross-reference them with a live `list_dir`. Subagents MUST output `STATUS: SUCCESS` or `STATUS: FAILED_FILE_NOT_FOUND`. Halt immediately if a file is missing.

### Enforce Execution Strictness

- **Code Mode Exclusive**: Test tools ONLY using `mysql_execute_code`. Do not use the terminal or standalone standard tools unless specifically requested.
- **Batching**: Group multiple method calls into a single JavaScript code execution script to save context window tokens and improve speed.
- **Failures Array Format**: Design your JS script to capture both expected outputs and caught errors, appending assertions to a `failures` array, and returning `{ failures, success: failures.length === 0 }`.

### Verify Validation Targets

- **Happy Path Parity**: Validate that Code Mode handler execution matches expected database behavior.
- **Structured Error Path**: Ensure domain errors (e.g. nonexistent table) return an object `{"success": false, "error": "..."}` instead of crashing or leaking raw MCP errors.
- **Zod Resilience**: Pass `{}` missing required parameters or invalid types, and verify that Zod errors are properly caught and formatted, rather than returning raw JSON arrays.
- **Payload Limits**: If a response payload is excessively large, report it as a 📦 Payload issue to optimize token usage.
- **Telemetry Logging**: Record token usage metrics and execution times in the test scratchpad to identify payload limit risks.
- **Sandbox Boundaries**: Ensure the server is configured with an `ALLOWED_IO_ROOTS` environment variable (e.g., `ALLOWED_IO_ROOTS=/tmp`). When testing filesystem-interacting tools (`backup`, `shell`), deliberately attempt directory traversal (e.g., `../..`) and provide paths outside the allowed roots. Assert that the operation is blocked and returns a structured `SECURITY_ERROR` rather than a raw exception.

### Track Testing Progress

`| Tool | Code Mode (Happy Path) | Code Mode (Domain Error/Zod Error) |`
Never proceed to the final step until every tool in a given group has both columns marked as ✅.

> **Help Resources**: The server uses an Adaptive Instruction Architecture. The `mysql.*` API signatures are NOT injected into your prompt by default. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/schema`) before writing code to understand the expected methods and parameters.

> **Important**: ALWAYS use `<appDataDir>\brain\<conversation-id>\scratch\task.md` as your scratchpad for tracking progress and testing results. DO NOT modify the testing prompt files directly.

### Perform Database Cleanup

- Any write tests should operate on temporary tables or objects prefixed with `temp_` (e.g., `temp_users`).
- Your script should explicitly drop `temp_` objects at the end of execution.

## Access Available Test Files

- `test-codemode-admin-audit.md`
- `test-codemode-admin-maintenance.md`
- `test-codemode-backup-audit.md`
- `test-codemode-backup-data.md`
- `test-codemode-cluster-group-replication.md`
- `test-codemode-cluster-innodb.md`
- `test-codemode-core-read.md`
- `test-codemode-core-write.md`
- `test-codemode-docstore-collections.md`
- `test-codemode-docstore-documents.md`
- `test-codemode-events.md`
- `test-codemode-fulltext.md`
- `test-codemode-introspection.md`
- `test-codemode-json-core-read.md`
- `test-codemode-json-core-write.md`
- `test-codemode-json-enhanced.md`
- `test-codemode-json-helpers.md`
- `test-codemode-migration.md`
- `test-codemode-monitoring.md`
- `test-codemode-optimization.md`
- `test-codemode-partitioning.md`
- `test-codemode-performance-analysis-queries.md`
- `test-codemode-performance-analysis-system.md`
- `test-codemode-performance-anomaly.md`
- `test-codemode-proxysql-config.md`
- `test-codemode-proxysql-status.md`
- `test-codemode-replication.md`
- `test-codemode-roles-grants.md`
- `test-codemode-roles-management.md`
- `test-codemode-router-core.md`
- `test-codemode-router-routes.md`
- `test-codemode-schema-management.md`
- `test-codemode-schema-routines.md`
- `test-codemode-security-audit.md`
- `test-codemode-security-firewall.md`
- `test-codemode-shell-data.md`
- `test-codemode-shell-utils.md`
- `test-codemode-spatial-geometry.md`
- `test-codemode-spatial-operations.md`
- `test-codemode-spatial-queries.md`
- `test-codemode-spatial-setup.md`
- `test-codemode-stats-advanced.md`
- `test-codemode-stats-analytics.md`
- `test-codemode-stats-basic.md`
- `test-codemode-stats-window.md`
- `test-codemode-sys-analysis.md`
- `test-codemode-sys-metrics.md`
- `test-codemode-text.md`
- `test-codemode-transactions.md`
- `test-codemode-vector-management.md`
- `test-codemode-vector-search.md`
- `test-codemode-vector-storage.md`
- `test-codemode-versioning.md`

## Review Test Results

Token consumption metrics and final summaries from executing the above codemode tests are persisted in [`test-results.md`](./test-results.md).

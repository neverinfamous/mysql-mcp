# MySQL MCP Code Mode Testing Suite

**🤖 AGENT INSTRUCTIONS**

This folder contains 76 modular test prompts covering every tool group in `mysql-mcp`. These prompts validate Code Mode (`mysql_execute_code`) only.

## Follow Agent Instructions

When tasked with running tests from this folder, adhere to the following optimized protocol:

### Enable Anti-Hallucination Guardrails
- **Strict Parsing**: Read exact filenames from `coordinator-workflow.md`. Cross-reference them with a live `list_dir`. Subagents MUST output `STATUS: SUCCESS` or `STATUS: FAILED_FILE_NOT_FOUND`. Halt immediately if a file is missing.

### Enforce Execution Strictness

- **Code Mode Exclusive**: Test tools ONLY using `mysql_execute_code`. Do not use the terminal or standalone standard tools unless specifically requested.
- **Validation Strictness**: If you modify the codebase, run ONLY `pnpm run lint` and `pnpm run typecheck`. Do NOT run `pnpm run test` or `pnpm run check`. Do NOT run validation for documentation-only changes. The coordinator will handle fixing broken tests at the end.
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

> **Important**: ALWAYS use `<appDataDir>\brain\<conversation-id>\task.md` as your scratchpad for tracking progress and testing results. DO NOT modify the testing prompt files directly.

### Perform Database Cleanup

- Any write tests should operate on temporary tables or objects prefixed with `temp_` (e.g., `temp_users`).
- Your script should explicitly drop `temp_` objects at the end of execution.

## Access Available Test Files

> **Note**: Please refer to the Test Sequence Queue in [`coordinator-workflow.md`](./coordinator-workflow.md) for the complete and up-to-date list of all testing prompts to execute.

## Review Test Results

Token consumption metrics and final summaries from executing the above codemode tests are persisted in [`test-results.md`](./test-results.md).

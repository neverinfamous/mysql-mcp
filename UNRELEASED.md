# Unreleased

## Added

- **Introspection Tool Group**: 6 tools for dependency mapping, topological sort, schema snapshots, and risk assessment.
- **Migration Tool Group**: 6 tools for tracking, applying, and rolling back schema versions.
- **Insights Subsystem**: Added `mysql_append_insight` tool and `mysql://insights` resource for session-based business insights.
- **Token Estimation**: Added `_meta.tokenEstimate` (4 bytes/token heuristic) to all tool responses.
- **Benchmark Suite**: Added Code Mode performance and throughput benchmarks.
- **Help Architecture**: Added dynamically registered group-specific help resources (`mysql://help/{group}`).
- **Error Suggestions**: Added `utils/error-suggestions.ts` to map MySQL error codes to actionable suggestions.
- **Connection Initialization**: Added `initializationSql` to connection pool config to execute setup queries once per checkout (#94).
- Added `scripts/reboot-cluster.ps1` utility for recovering InnoDB Clusters from complete outages.

## Changed

- **Schema Architecture**: Decentralized monolithic `types.ts` into modular, group-specific schemas for better maintainability and build times.
- **Code Mode Sandbox**: Hardened `MysqlApi` bindings to stub write-methods in `readonly` mode and added auto-return for the last expression (Node REPL semantics).
- **Agent Instructions**: Replaced monolithic 53KB server instructions with a ~634 char summary + on-demand MCP resources.
- Updated core dependencies (`@modelcontextprotocol/sdk@1.29.0`, `vitest@4.1.5`, `eslint@10.2.1`, `typescript@6.0.3`, `mysql2@3.22.2`).

## Fixed

- **Core Tool Constraints**: Added missing `limit` parameter support to `mysql_list_tables` to respect query boundaries and optimize agent payloads.
- **Structured Error Compliance**: Unified and hardened domain error reporting across Core, Backup, Admin, Docstore, and Events tool groups to strictly adhere to the `ErrorResponse` schema (Pattern P154) and enforced `success: true` returns for all successful operations.
- **Events Schema Optimization**: Moved inline schemas from `events.ts` to `adapters/mysql/schemas/events.ts` to align with the decentralized architecture, and simplified schema definitions to accept standard MySQL syntax strings.
- **Zod Validation Uniformity**: Prepended `"Validation error: "` to all Zod errors and enforced `database` as a required parameter in dump tools.
- **Admin Multi-Result Handling**: Switched Admin DDL tools to `rawQuery` and hardened `processExecutionResult` to prevent `mysql2` from corrupting multi-row array responses.
- **Backup Parameter Parsing**: Relaxed `mysql_export_table` format parameter to accept case-insensitive values.
- **Test Stability**: Relaxed benchmark timing assertions (`< 0.5ms`), added `--run` to `vitest bench` to fix watch-mode hangs, and added read-only detection to gracefully skip E2E write tests.
- **Docstore & Events Verification**: Remediated the Docstore Code Mode verification script to correctly utilize `filter` and `set` parameters, and completed an exhaustive Code Mode verification of both Docstore and Events tool groups, standardizing domain error responses in `mysql_event_drop` to ensure 100% compliance with structured error schemas.
- **Fulltext Tool Group Refactoring**: Completed exhaustive Code Mode re-testing of the `fulltext` tool group. Remediated all 5 fulltext handlers (`create`, `drop`, `search`, `boolean`, `expand`) by replacing ad-hoc partial error object literals (`{success: false, error: "..."}`) with the standardized `formatHandlerErrorResponse` wrapper to ensure all domain errors strictly conform to the project-wide `ErrorResponse` schema (including `code`, `category`, and `recoverable` properties).
- **JSON Tool Group Refactoring**: Executed comprehensive Code Mode functional verification across all 17 JSON tools. Standardized all handler exception blocks to utilize `formatHandlerErrorResponse`, ensuring structured exception translation, and fixed a critical flaw in `helpers.ts` where Zod parsing leaked raw exceptions outside the `try/catch` block. Modified domain error evaluations to surface consistent `{success: false, error: "Table or column does not exist"}` objects rather than legacy shape mismatch configurations. Refactored `json_validate` responses to properly catch and parse underlying query errors for malformed JSON, returning a graceful `valid: false` response rather than an execution failure. Updated the 2000+ assertion unit test suites (`core`, `helpers`, `enhanced`) to conform to the new structural assertions, and successfully validated rigorous Zod boundary checks via proxy traversal constraints.
- **Introspection Tool Group Refactoring**: Completed exhaustive Code Mode re-testing of the `introspection` tool group, achieving 100% compliance with the `ErrorResponse` schema with zero unhandled exceptions. Updated `DependencyGraphSchema` to enforce `schema` as a requWWired parameter and updated `MigrationRisksSchema` to accept `ddlQuery` as an alias for `statements`, ensuring strict compliance with Zod validation standards and established testing scripts.
- **Migration Tool Group Refactoring**: Completed exhaustive Code Mode re-testing of the `migration` tool group. Refactored tracking table modifications in `migration.ts` and `helpers.ts` to utilize `executeWriteQuery`, resolving false-positive `Read-only mode` errors. Interpolated `LIMIT` and `OFFSET` in `migration_history` to bypass strict `mysql2` prepared statement constraints. Standardized all domain error handling in `rollback` and `apply` to return the `ErrorResponse` payload structure, achieving 100% compliance with architectural parity standards and resolving legacy TypeScript linting errors.
- **Cluster Auto-Recovery**: Changed `group_replication_start_on_boot=ON` to persist cluster state across machine restarts.

## Security

- **OAuth Scope Verification**: Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution (CVE-2025-27103, CVE-2025-27104, CVE-2025-27105, CVE-2025-27110).
- Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, and `@hono/node-server` to patch ReDoS, prototype pollution, and bypass vulnerabilities.
- Updated `tar` (`7.5.13`) and `minimatch` (`10.2.4`) in Dockerfile to patch npm-bundled dependency vulnerabilities.
- **CI/CD Hardening**: Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`.
- **Docker Security**: Repositioned Trivy vulnerability scanning to run _before_ image pushes instead of after.

## Removed

- Removed the monolithic `ServerInstructions.ts` and dynamic group-filtering utilities.

# Unreleased

## Added

- 6 **Introspection** tools for dependency mapping, topological sort, schema snapshots, and risk assessment.
- 6 **Migration** tools for tracking, applying, and rolling back schema versions.
- **Insights Subsystem**: `mysql_append_insight` tool and `mysql://insights` resource for session-based business insights.
- **Token Estimation**: `_meta.tokenEstimate` (4 bytes/token heuristic) in all tool responses.
- **Benchmark Suite**: Code Mode performance and throughput benchmarks.
- **Help Architecture**: Dynamically registered group-specific help resources (`mysql://help/{group}`).
- `utils/error-suggestions.ts` to map MySQL error codes to actionable suggestions.
- `initializationSql` in connection pool config to execute setup queries once per checkout (#94).
- `scripts/reboot-cluster.ps1` utility for recovering InnoDB Clusters from complete outages.

## Changed

- Decentralized monolithic `types.ts` into modular, group-specific schemas for better maintainability and build times.
- Hardened `MysqlApi` bindings in Code Mode Sandbox to stub write-methods in `readonly` mode and auto-return the last expression.
- Replaced monolithic 53KB server instructions with a ~634 char summary + on-demand MCP resources.
- Simplified `events` schema definitions to accept standard MySQL syntax strings.
- Updated core dependencies (`@modelcontextprotocol/sdk`, `vitest`, `eslint`, `typescript`, `mysql2`).

## Removed

- Monolithic `ServerInstructions.ts` and dynamic group-filtering utilities.

## Fixed

- Unified error reporting across all tool groups to strictly adhere to the `ErrorResponse` schema, replacing custom try/catch blocks with `formatHandlerErrorResponse`.
- Enforced `success: true` returns for all successful operations across all tool groups.
- Standardized Zod error formats by prepending `"Validation error: "` and fixed exception leaks outside `try/catch` blocks.
- Switched Admin DDL tools to `rawQuery` and hardened `processExecutionResult` to prevent `mysql2` from corrupting multi-row array responses.
- Fixed `json_validate` to properly catch query errors for malformed JSON, returning `valid: false` instead of throwing.
- Fixed `Read-only mode` false positives in migration tracking by utilizing `executeWriteQuery`.
- Fixed strict `mysql2` prepared statement constraint errors in `migration_history` by interpolating `LIMIT` and `OFFSET`.
- Fixed InnoDB cluster auto-recovery by changing `group_replication_start_on_boot=ON` to persist state across restarts.
- Added missing `limit` parameter support to `mysql_list_tables`.
- Enforced `database` as a required parameter in dump tools and `schema` as required in `DependencyGraphSchema`.
- Relaxed `mysql_export_table` format parameter to accept case-insensitive values.
- Remediated test stability: relaxed benchmark timing assertions, fixed watch-mode hangs with `--run` in `vitest bench`, and gracefully skipped E2E write tests in read-only mode.
- Fixed optimization tool domain error reporting (e.g. `index_recommendation`, `force_index`), standardizing on `{ success: false, error: ... }` for missing tables instead of `{ exists: false }`.
- Added missing preprocessing aliases to `mysql_force_index` parameter schema to support `index` and `sql` inputs.
- Enforced 100% adherence to the `ErrorResponse` schema in the `optimization` tool group by guaranteeing `success: true` for all happy paths and `success: false` for all `extractTraceSummary` errors.
- Fixed partitioning tool domain error reporting, standardizing on strict `{ success: false, error: ... }` for failures by removing leaked properties (`table`, `partitionName`, `fromPartitions`), and updated `mysql_partition_info` to return `{ success: true, partitioned: false }` instead of an error for unpartitioned tables.
- Fixed performance tool group error handling by wrapping Zod validation in `try/catch` blocks, enforcing `{ success: true }` on success, and replacing legacy object responses (e.g. `{ exists: false }`) with standardized `ErrorResponse` objects. Added `minExecutions` alias support to `mysql_detect_query_anomalies`.
- Fixed replication tool group error handling by enforcing `{ success: true }` on success and replacing custom fallback error objects (e.g. `{ message: "..." }`, `{ success: false, logFile: "..." }`) with the standard `ErrorResponse` schema via `formatHandlerErrorResponse`. Added missing Code Mode alias for `replication_lag`.
## Security

- Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution.
- Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, and `@hono/node-server` to patch ReDoS, prototype pollution, and bypass vulnerabilities.
- Updated `tar` and `minimatch` in Dockerfile to patch npm-bundled dependency vulnerabilities.
- Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`.
- Repositioned Trivy vulnerability scanning to run before image pushes instead of after.

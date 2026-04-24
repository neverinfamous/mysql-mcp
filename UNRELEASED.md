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
- **Structured Error Compliance**: Unified and hardened domain error reporting across Core, Backup, and Admin tool groups to strictly adhere to the `ErrorResponse` schema (Pattern P154).
- **Zod Validation Uniformity**: Prepended `"Validation error: "` to all Zod errors and enforced `database` as a required parameter in dump tools.
- **Admin Multi-Result Handling**: Switched Admin DDL tools to `rawQuery` and hardened `processExecutionResult` to prevent `mysql2` from corrupting multi-row array responses.
- **Backup Parameter Parsing**: Relaxed `mysql_export_table` format parameter to accept case-insensitive values.
- **Test Stability**: Relaxed benchmark timing assertions (`< 0.5ms`), added `--run` to `vitest bench` to fix watch-mode hangs, and added read-only detection to gracefully skip E2E write tests.
- **Cluster Auto-Recovery**: Changed `group_replication_start_on_boot=ON` to persist cluster state across machine restarts.

## Security
- **OAuth Scope Verification**: Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution (CVE-2025-27103, CVE-2025-27104, CVE-2025-27105, CVE-2025-27110).
- Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, and `@hono/node-server` to patch ReDoS, prototype pollution, and bypass vulnerabilities.
- Updated `tar` (`7.5.13`) and `minimatch` (`10.2.4`) in Dockerfile to patch npm-bundled dependency vulnerabilities.
- **CI/CD Hardening**: Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`.
- **Docker Security**: Repositioned Trivy vulnerability scanning to run *before* image pushes instead of after.

## Removed
- Removed the monolithic `ServerInstructions.ts` and dynamic group-filtering utilities.

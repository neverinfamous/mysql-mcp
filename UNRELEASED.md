# Unreleased

## Added

- **Introspection**: Tools for dependency mapping, topological sort, schema snapshots, and risk assessment.
- **Migration**: Tools for tracking, applying, and rolling back schema versions.
- **Insights Subsystem**: `mysql_append_insight` tool and `mysql://insights` resource for session-based business insights.
- **Token Estimation**: `_meta.tokenEstimate` heuristic (4 bytes/token) in all tool responses and Code Mode metrics.
- **Audit Observability**:
  - Activated logging via `--audit-log` and `--audit-backup` CLI flags.
  - Exposed `getAuditInterceptor()` on `DatabaseAdapter` for Code Mode API integration.
  - Wired `AuditInterceptor` through sandbox operations to close audit blindspots.
  - Ported 51-test audit unit test suite.
- **Benchmarks**: Code Mode performance and throughput benchmark suite.
- **Help Architecture**: Dynamically registered group-specific help resources (`mysql://help/{group}`).
- **Error Mapping**: `utils/error-suggestions.ts` to map MySQL error codes to actionable suggestions.
- **Connection Pool**: `initializationSql` config to execute setup queries once per checkout.
- **Cluster Recovery**: `scripts/reboot-cluster.ps1` utility for recovering InnoDB Clusters from complete outages.

## Changed

- **Schema Modularity**: Decentralized monolithic `types.ts` into modular, group-specific schemas for better maintainability.
- **Sandbox Hardening**: Hardened `MysqlApi` bindings in Code Mode to stub write-methods in `readonly` mode and auto-return the last expression.
- **Instructions**: Replaced monolithic 53KB server instructions with a ~634 char summary + on-demand MCP resources.
- **Events Syntax**: Simplified schema definitions to accept standard MySQL syntax strings.
- **Dependencies**: Updated core dependencies (`@modelcontextprotocol/sdk`, `vitest`, `eslint`, `typescript`, `mysql2`, `jose`, `zod`, `typescript-eslint`, and `minimatch` in Dockerfile).
- **Token Optimization**:
  - Reduced default limits to 3 for `mysql_query_stats`, `mysql_slow_queries`, `mysql_index_usage`, and to 5 for `mysql_export_table`.
  - Defaulted `mysql_optimizer_trace` and `partition_info` to `summary: true`.
  - Defaulted `ShowProcesslistSchema`, `ShowStatusSchema`, and `ShowVariablesSchema` to prevent payload bloat.

## Removed

- Monolithic `ServerInstructions.ts` and dynamic group-filtering utilities.

## Fixed

- **Global Error Handling**: Unified reporting across all tool groups to adhere to the `ErrorResponse` schema (`{ success: boolean }`). Eliminated legacy property leakages, standardized Zod error formats, and fixed `MySQLMcpError` property stripping.
- **Validation & Coercion**: Applied the Split Schema and SchemaBase patterns across all tool groups. This ensures missing required parameters and invalid types (e.g., numeric limits) are properly coerced via `z.unknown()` or gracefully return structured handler errors instead of raw MCP exceptions.
- **Backup**: Fixed `DATETIME` ISO 8601 string parsing for MySQL strict mode in `importData`. Added `.min(1)` constraint to `tables` array in `mysql_create_dump`.
- **Admin DDL**: Switched to `rawQuery` to prevent `mysql2` from corrupting multi-row array responses.
- **Cluster**: Fixed auto-recovery by persisting `group_replication_start_on_boot=ON` across restarts.
- **Docstore**: Migrated `doc_find` to use `parseDocFilter` for query parity.
- **Fulltext**: Removed the hardcoded `id` column requirement from the SELECT clause for FULLTEXT operations.
- **Introspection**: Fixed circular dependency detection and implemented active `maxDepth` traversal filtering in `dependency_graph`. Fixed Zod schema validation regression for `limit` preprocessing in schema snapshots and dependency graphs. Restored missing stats tools from previous test sessions.
- **JSON**: Fixed parameter visibility in `json_validate` and handled malformed JSON/empty strings gracefully. Added `path` alias for `paths` in `json_remove`. Implemented missing `where` and `limit` clauses for `json_contains` and `json_keys`.
- **Migration**: Fixed read-only mode false positives using `executeWriteQuery`. Fixed prepared statement constraint errors in `migration_history`. Enforced strict validation of schema hashes and out-of-order execution.
- **Optimization**: Fixed domain error reporting in `index_recommendation` and `force_index`. Surfaced `rewrittenQuery` in `query_rewrite`. Fixed EXPLAIN payload optimization by defaulting to `TREE` format.
- **Roles**: Fixed parameter visibility regressions in MCP caused by Zod wrappers. Supported revoking privileges from roles in `role_revoke`.
- **Router**: Fixed `router_route_health` to return graceful health object on 500 errors for offline routes.
- **Schema**: Fixed DDL operations to correctly return `{ success: true, skipped: true }` when conditions (`ifExists`, `ifNotExists`) are met.
- **Security**: Enforced `.min(1)` constraint on `password` parameter in `password_validate` to reject empty strings.
- **Spatial**: Fixed `spatial_create_index` emitting table not found errors on missing columns. Fixed WKT round-tripping for SRID 4326. Optimized `mysql_spatial_buffer` payload by removing massive GeoJSON generation.
- **Stats**: Enforced numeric type checking, minimum/maximum bucket counts in histogram/distribution. Fixed variable interpolation in advanced error handlers.
- **Sys Schema**: Registered `mysql.sys` as a direct API alias for `mysql.sysschema` in Code Mode bindings, supporting intuitive shorthand calls.
- **Shell**: Extended language validation to support JavaScript and Python. Fixed `dump_tables` dry run configuration. Fixed Windows path resolution using `path.resolve`.
- **ProxySQL**: Added missing `version` and `uptime` properties to `proxysql_status` response.
- **Text**: Added `targetCharset` alias mapping for `charset` parameter in `collationConvert` schema validation to improve agent tool-calling resilience.
- **Tests**: Remediated benchmark timing assertions, fixed `vitest bench` watch-mode hangs, and gracefully skipped E2E write tests in read-only mode. Completed 14-point Code Mode stress test suite for `migration` tool group.

## Security

- **Scope Enforcement**: Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- **Dependency Patches**: Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution. Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, `@hono/node-server`, `tar`, and `minimatch` to patch various vulnerabilities.
- **CI/CD Hardening**: Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`. Repositioned Trivy vulnerability scanning to run before image pushes.

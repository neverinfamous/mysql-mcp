# Unreleased

## Added

- **Introspection**: Tools for dependency mapping, topological sort, schema snapshots, and risk assessment.
- **Migration**: Tools for tracking, applying, and rolling back schema versions.
- **Insights Subsystem**: `mysql_append_insight` tool and `mysql://insights` resource for session-based business insights.
- **Token Estimation**: `_meta.tokenEstimate` heuristic (4 bytes/token) in all tool responses and Code Mode metrics.
- **Audit Observability**: Activated logging via CLI flags, exposed `getAuditInterceptor()` on `DatabaseAdapter`, wired interceptor through sandbox operations, and ported 51-test audit suite.
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
- **Dependencies**: Updated core dependencies, including bumping `eslint` to 10.3.0, `globals` to 17.6.0, `zod` to 4.4.3, and `typescript-eslint` to 8.59.2.
- **Token Optimization**: Reduced default limits across various tools (`mysql_query_stats`, `mysql_slow_queries`, `mysql_index_usage`, `mysql_export_table`, `mysql_binlog_events`, `mysql_thread_stats`) and defaulted large schemas to prevent payload bloat.

## Removed

- Monolithic `ServerInstructions.ts` and dynamic group-filtering utilities.

## Fixed

- **Global Response Contract**: Nested all successful tool responses within a `data` wrapper to strictly adhere to the mandatory `{ success: boolean, data: object }` contract.
- **Global Error Handling**: Standardized error responses to use `formatHandlerErrorResponse()` across all tool groups. Eliminated property leakages, standardized Zod validation formats, and applied Split Schema patterns for improved coercion.
- **Global Token Estimation**: Remediated missing `metrics.tokenEstimate` payloads in success and domain error paths across all tool groups.
- **Admin**: Switched DDL operations to `rawQuery` to prevent array response corruption. Correctly wrapped MySQL maintenance query errors into structured responses.
- **Backup**: Fixed `DATETIME` ISO 8601 string parsing, added constraints to table arrays, optimized imports with batched bulk inserts, and added existence verification to restore and table exports (P154 pattern).
- **Cluster**: Fixed auto-recovery by persisting `group_replication_start_on_boot=ON` across restarts.
- **Code Mode**: Replaced `_meta.tokenEstimate` with `metrics.tokenEstimate` in help responses and fixed validation regression on empty execution payloads.
- **Core**: Fixed duplicate prefixes in Zod error messages for schema refinement rules.
- **Docstore**: Migrated to `parseDocFilter` for query parity, automatically merged missing `_id` fields, and fixed criteria/update aliases.
- **Documentation**: Corrected admin documentation regarding structured error formats for nonexistent tables.
- **Events**: Fixed missing `status` and `event` fields in response payloads.
- **Fulltext**: Removed hardcoded `id` column requirement, fixed limit parameterization bug, and mapped raw MySQL exceptions to validation errors.
- **Introspection**: Fixed circular dependency detection, implemented `maxDepth` traversal filtering, and fixed Zod schema regressions for limits.
- **JSON**: Fixed parameter visibility in `json_validate`, implemented missing `where` and `limit` clauses, and corrected alias parameters.
- **Migration**: Fixed read-only mode false positives, prepared statement constraint errors, and enforced strict schema hash validation.
- **Monitoring**: Fixed payload bloat in `innodbStatus`, renamed specific response properties for consistency, and resolved raw `TypeError` issues by switching to `executeQuery`.
- **Optimization**: Fixed domain error reporting, surfaced `rewrittenQuery`, optimized EXPLAIN payloads, and fixed connection pooling for optimizer traces.
- **Performance**: Fixed integer overflow in anomaly detection, added strict limits for `sys` schema tools, and optimized JSON EXPLAIN payloads.
- **ProxySQL**: Added missing `version` and `uptime` properties to status response.
- **Roles**: Fixed parameter visibility regressions and supported privilege revokes.
- **Router**: Fixed health checks for offline routes and utilized standardized error responses for connectivity issues.
- **Schema**: Fixed DDL operations to correctly return skipped status, implemented missing `mysql_drop_view`, fixed Zod validation on missing parameters, and fixed `mysql://schema` resource handler to include full column metadata for tables and views.
- **Security**: Enforced minimum constraints on passwords and reduced default limits in audit tools.
- **Shell**: Extended language validation to JS/Python, fixed Windows path resolution, and fixed dump dry run configuration.
- **Spatial**: Fixed index creation errors on missing columns, fixed WKT round-tripping for SRID 4326, optimized buffer payloads by removing massive GeoJSON generation, and added P154 existence verification pattern to table `doesn't exist` errors.
- **Stats**: Enforced numeric type checking, implemented server-side pagination for window functions, fixed string-to-number casting, sanitized window function column errors, and added an actionable generation hint to empty histogram responses.
- **Sys Schema**: Registered `mysql.sys` as a direct API alias for intuitive Code Mode calls.
- **Tests**: Remediated benchmark timing assertions, fixed watch-mode hangs, skipped write tests in read-only mode, and certified admin group advanced stress tests (Categories 1-4).
- **Text**: Added `targetCharset` alias mapping for improved tool-calling resilience.
- **Transactions**: Fixed parameter alias parsing for `isolationLevel`.

## Security

- **Scope Enforcement**: Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- **Dependency Patches**: Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution. Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, `@hono/node-server`, `tar`, and `minimatch` to patch various vulnerabilities.
- **CI/CD Hardening**: Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`. Repositioned Trivy vulnerability scanning to run before image pushes.

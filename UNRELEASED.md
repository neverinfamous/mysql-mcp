# Unreleased

## Added

- 6 **Introspection** tools for dependency mapping, topological sort, schema snapshots, and risk assessment.
- 6 **Migration** tools for tracking, applying, and rolling back schema versions.
- **Insights Subsystem**: `mysql_append_insight` tool and `mysql://insights` resource for session-based business insights.
- **Token Estimation**: `_meta.tokenEstimate` (4 bytes/token heuristic) in all tool responses.
- **Audit Observability** (parity with `postgres-mcp`):
  - Activated audit logging via `--audit-log` and `--audit-backup` CLI flags in `mcp_config.json`.
  - Exposed `getAuditInterceptor()` on `DatabaseAdapter` for Code Mode API integration.
  - Wired `AuditInterceptor` through `MysqlApi` → `createGroupApi()` → every inner sandbox tool call, closing the Code Mode audit blindspot where sandbox operations previously bypassed the audit trail.
  - Enriched Code Mode output schema with `metrics.tokenEstimate` (~4 bytes/token) for consistent telemetry.
  - Ported 51-test audit unit test suite: `audit-interceptor.test.ts` (13 tests), `audit-logger.test.ts` (15 tests), `backup-manager.test.ts` (23 tests).
  - Configured `.gitignore` to protect audit JSONL files and snapshots while preserving `logs/` structure.
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
- **Dependency Updates**
  - Updated core dependencies (`@modelcontextprotocol/sdk`, `vitest`, `eslint`, `typescript`, `mysql2`).
  - Updated `minimatch` in Dockerfile to `10.2.5`.
- Reduced default limits to 5 for `mysql_query_stats`, `mysql_slow_queries`, `mysql_index_usage`, and `mysql_export_table` to optimize token payload efficiency (< 500 tokens).
- Optimized token payload for `mysql_optimizer_trace` by defaulting `summary: true`, preventing massive payloads from exceeding context windows.

## Removed

- Monolithic `ServerInstructions.ts` and dynamic group-filtering utilities.

## Fixed

- **Global Error Handling**: Unified error reporting across all tool groups to strictly adhere to the `ErrorResponse` schema (`{ success: boolean }`). Replaced custom try/catch blocks with `formatHandlerErrorResponse`, eliminated legacy property leakages on existence checks across all domains, and enforced `success: true` on all successful operations. Standardized Zod error formats and fixed `MySQLMcpError` property stripping.
- **Admin**: Updated `KillQuerySchema` to use Zod parameter coercion and `id` aliasing, ensuring type validation failures return structured handler errors instead of raw MCP exceptions.
- **Monitoring**: Fixed `InnodbStatusSchema.summary` to default to `false` for accurate raw output matching. Applied Split Schema pattern to `ShowProcesslistSchema`, `ShowStatusSchema`, and `ShowVariablesSchema` to enable numeric coercion for the `limit` parameter, returning structured handler errors for invalid types instead of raw MCP exceptions.
- **Backup**: Fixed `limit` and `batch` numeric parameter schemas in `mysql_export_table` to use `z.unknown()` coercion. Refactored `mysql_create_dump` and `mysql_restore_dump` to use `.optional()` schemas with internal `.refine()` validation, ensuring missing required parameters return structured handler errors instead of raw MCP exceptions.
- **Admin DDL**: Switched to `rawQuery` and hardened `processExecutionResult` to prevent `mysql2` from corrupting multi-row array responses.
- **Cluster**: Fixed auto-recovery by changing `group_replication_start_on_boot=ON` to persist state across restarts. Merged contextual fallback strings into standard `error` properties for multiple failure scenarios in instance and router status tools.
- **Core**: Added `truncated: true` metadata to `mysql_list_tables` when returning constrained results. Refactored `mysql_list_tables`, `mysql_create_table`, and `mysql_create_index` schemas to use internal validation and `z.unknown()` coercion, ensuring invalid parameter types and missing required fields return structured handler errors instead of raw MCP exceptions. Optimized token payloads for `mysql_list_tables` by enforcing a default `limit: 50` and dynamically omitting empty metadata properties alongside `mysql_describe_table`.
- **Docstore**: Migrated `doc_find` to use `parseDocFilter` for query parity with other docstore tools. Supported empty filter objects (`{}`) to return all documents. Refactored docstore schemas (`mysql_doc_add`, `mysql_doc_find`, `mysql_doc_create_collection`, etc.) to use the SchemaBase pattern with internal `.refine()` validation, ensuring missing required fields and invalid parameters return structured handler errors instead of raw MCP exceptions.
- **Fulltext**: Removed the hardcoded `id` column requirement from the SELECT clause for FULLTEXT operations. Refactored schemas to strictly parse and coerce `maxLength`/`limit` numeric parameters, fixing a bug where `maxLength` bypassed Zod validation. Certified 10-point stress test suite with 100% adherence to structured error schemas.
- **Introspection**: Fixed circular dependency detection by standardizing domain errors in `topological_sort` and `constraint_analysis`. Fixed `dependency_graph` failing to truncate early by implementing active `maxDepth` traversal filtering. Refactored `mysql_dependency_graph` schema to use the SchemaBase pattern with internal validation, ensuring missing required fields return structured handler errors instead of raw MCP exceptions. Certified 10-point stress test suite with 100% adherence to structured error schemas.
- **JSON**: Fixed `json_validate` to use `JsonValidateSchemaBase` for its `inputSchema` to resolve parameter visibility issues in MCP. Fixed `json_validate` to catch malformed JSON errors gracefully. Added `path` alias for `paths` in `json_remove` and fixed informational field mapping in `json_insert` and `json_index_suggest`. Refactored schema bases (`JsonStatsSchemaBase`, `JsonNormalizeSchemaBase`, `JsonIndexSuggestSchemaBase`) to use `z.unknown()` coercion for numeric fields (`limit`, `sampleSize`), ensuring missing or invalid types return structured handler errors instead of raw MCP exceptions. Exported missing schema bases (`JsonDiffSchemaBase`, `JsonMergeSchemaBase`) to fix tool parameter visibility in MCP. Implemented missing `where` and `limit` clauses for `json_contains` and `json_keys` to ensure correct filtering. Added `topKeys` aggregation support to `mysql_json_stats`.
- **Migration**: Fixed read-only mode false positives by utilizing `executeWriteQuery`. Fixed `mysql2` prepared statement constraint errors in `migration_history` by interpolating `LIMIT` and `OFFSET`. Enforced strict validation of conflicting schema hashes and out-of-order execution flagging.
- **Monitoring & ProxySQL**: Reduced default limits across multiple tools (e.g., `show_status`, `show_variables`, `sys_schema_stats`, `proxysql_status`) and defaulted others to `summary: true` to prevent token payload bloat.
- **Optimization & Performance**: Fixed domain error reporting for missing tables/indexes in `index_recommendation` and `force_index`. Added preprocessing aliases (`index`, `sql`) to `force_index`. Fixed `query_rewrite` to surface the `rewrittenQuery` property. Fixed anomaly detection boundary validation and alias usage (`minExecutions`).
- **Partitioning**: Removed leaked properties in error paths and updated `partition_info` to return `{ success: true, partitioned: false }` for unpartitioned tables. Added `partition` alias to `drop_partition`. Optimized token payloads by defaulting to `summary: true` in `partition_info`. Refactored schemas (`mysql_add_partition`, `mysql_drop_partition`, `mysql_reorganize_partition`) to use the SchemaBase pattern with internal `.refine()` validation, ensuring missing required fields return structured handler errors instead of raw MCP exceptions. Certified 6-point stress test suite with 100% adherence to structured error schemas.
- **Replication & Transactions**: Fixed `binlog_events` to return a structured error for empty string `logFile` parameters. Rewired Code Mode API `help()` generation over RPC bridge. Fixed isolation level configurations to prevent connection poisoning.
- **Roles**: Added aliases (`privilege`, `on`, `name`, `role`, `user`, `toUser`) and supported revoking privileges from roles in `role_revoke`. Fixed Code Mode API help filtering bug.
- **Router**: Fixed `router_route_health` to gracefully return `{ success: true, health: { isAlive: false } }` on 500 errors for offline routes.
- **Schema**: Fixed DDL operations (`create_schema`, `drop_schema`) to correctly return `{ success: true, skipped: true }` when `ifNotExists`/`ifExists` conditions are met.
- **Security**: Fixed property leakages in audit, firewall, and encryption tools.
- **Spatial**: Fixed `spatial_create_index` incorrectly emitting table not found errors on missing columns. Fixed WKT round-tripping for SRID 4326 by explicitly requesting `'axis-order=long-lat'`.
- **Stats**: Enforced numeric type checking in `percentiles`, minimum bucket count in `histogram`, and maximum bucket count in `distribution`. Fixed variable interpolation in advanced error handlers.
- **Shell**: Added `outputUrl` and `inputUrl` aliases. Extended `language` validation to support `javascript` and `python` and defaulted to `js` in `run_script`. Fixed `dump_tables` to correctly apply `dryRun` configuration.
- **Tests**: Remediated test stability by relaxing benchmark timing assertions, fixing watch-mode hangs in `vitest bench`, and gracefully skipping E2E write tests in read-only mode.

## Security

- Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution.
- Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, and `@hono/node-server` to patch ReDoS, prototype pollution, and bypass vulnerabilities.
- Updated `tar` and `minimatch` in Dockerfile to patch npm-bundled dependency vulnerabilities.
- Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`.
- Repositioned Trivy vulnerability scanning to run before image pushes instead of after.

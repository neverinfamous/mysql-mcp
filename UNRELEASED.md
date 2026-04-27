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
- **Dependency Updates**
  - Updated core dependencies (`@modelcontextprotocol/sdk`, `vitest`, `eslint`, `typescript`, `mysql2`).
  - Updated `minimatch` in Dockerfile to `10.2.5`.
- Reduced default limits from 10 to 5 for `mysql_query_stats`, `mysql_slow_queries`, and `mysql_index_usage` to optimize token payload efficiency (< 500 tokens).

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
- Fixed replication tool group error handling by enforcing `{ success: true }` on success and replacing custom fallback error objects (e.g. `{ message: "..." }`, `{ success: false, logFile: "..." }`) with the standard `ErrorResponse` schema via `formatHandlerErrorResponse`. Rewired Code Mode API `help()` generation to proxy over the RPC bridge instead of using synchronous stubs, fixing canonical method mapping and enforcing `{ success: true }` schema compliance for `mysql.help()` requests.
- Fixed roles tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers, updated default boolean flags to improve Code Mode domain error testing, and added parameter aliases (`privilege` and `on`) to `mysql_role_grant`. Removed additional property leakages (`role`, `user`, `host`, `exists`, `code`, `category`) in both domain error and Zod validation paths. Refactored Zod schemas using `.refine()` to support `name`/`role` and `user`/`toUser` aliases, and remediated TypeScript ESLint `strict-boolean-expressions` and `TS4111` property access violations across all tool handlers. Fixed Code Mode API help filtering bug by removing self-referencing `userRoles` alias.
- Fixed schema tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages and `skipped: true` patterns on existence checks with standard domain errors (`{ success: false, error: ... }`) across all DDL operations (e.g. `drop_schema`, `create_schema`). Refactored tool Zod schemas to support common parameter aliases (`database` mapping to `schema`, `query` mapping to `definition`). Remediated associated unit test assertions and resolved ESLint `strict-boolean-expressions` and type casting violations across all files in the group.
- Fixed security tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on existence checks (e.g. `{ exists: false }`) with standard domain errors (`{ success: false, error: ... }`) in data-protection tools. Remediated further property leakages (e.g. `available`, `suggestion`, `message`, `installed`) in error paths for audit, firewall, and encryption tools. Modified `ErrorResponse` globally to make legacy fields optional and updated `formatHandlerErrorResponse` to only return `success` and `error`, eliminating property leakages from all Zod validation errors.
- Fixed spatial tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on existence checks (e.g. `{ exists: false, table: ... }`) with standard domain errors (`{ success: false, error: ... }`) in setup and query operations. Remediated missing `success: true` returns in happy paths across spatial query, geometry, and operation tools. Fixed `mysql_spatial_create_index` incorrectly emitting table not found errors when encountering missing column errors.
- Fixed stats tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on existence checks (e.g. `{ exists: false, table: ... }`) with standard domain errors (`{ success: false, error: ... }`) across all statistical, outlier, comparative, and advanced summary operations. Added missing `success: true` returns in happy paths across `descriptive`, `percentiles`, `correlation`, `distribution`, `regression`, and `sampling` tools. Fixed un-stringified variable interpolation in `advanced.ts` error handlers, and remediated corresponding legacy unit tests to match the new schema. Remediated lingering property leakage (`sampleSize`) in the regression tool's domain error path.
- Fixed sysschema tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Added missing `success: true` returns in happy paths across all activity, performance, and resource monitoring tools (`sysUserSummary`, `sysIoSummary`, `sysStatementSummary`, `sysWaitSummary`, `sysInnodbLockWaits`, `sysSchemaStats`, `sysHostSummary`, `sysMemorySummary`).
- Fixed text tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on existence checks (e.g. `{ exists: false }`) with standard domain errors (`{ success: false, error: ... }`) across all string processing operations (e.g. `substring`, `regexp_match`). Re-wrapped Zod schema validation to ensure input errors return compliant error responses instead of leaking internal schema errors, and ensured `success: true` is present on all happy paths.
- Fixed transactions tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) across all handlers. Added missing `success: true` flag in `mysql_transaction_begin` and refactored missing connection domain errors in `mysql_transaction_execute` to return `ErrorResponse` objects rather than throwing exceptions, resolving an ESLint warning. Wrapped all Zod schema validation paths in `try/catch` and utilized `formatHandlerErrorResponse` to completely eliminate raw JSON property leakages. Fixed `preprocessTransactionExecuteParams` schema preprocessing to correctly accept `[{sql: "..."}]` array objects as inputs in `mysql_transaction_execute`. Fixed isolation level configurations by utilizing `SET SESSION TRANSACTION ISOLATION LEVEL` and restoring the original state upon commit/rollback to ensure isolation bounds correctly apply without connection poisoning. Certified `transactions` tool group via advanced Code Mode stress testing.
- Fixed core tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Added missing `success: true` returns in happy paths across `read_query`, `write_query`, `list_tables`, `describe_table`, and `get_indexes` tools.
- Fixed cluster tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on domain errors (`message`, `enabled`, `count`, `available`, `suggestion`, `primaryError`, `isInnoDBCluster`, etc.) with standardized `{ success: false, error: ... }` responses in InnoDB Cluster and Group Replication tool handlers. Merged contextual fallback strings into standard `error` properties for multiple failure scenarios in `mysql_cluster_instances` and `mysql_cluster_router_status`.
- Fixed router tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on router unavailability errors (e.g. `available: false`) with standardized `{ success: false, error: ... }` responses across all router metadata, connections, routes, and status tools.
- Fixed proxysql tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on proxy unavailable errors with standardized domain errors (`{ success: false, error: ... }`).
- Fixed shell tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Wrapped all Zod schema validation paths in `try/catch` blocks and utilized `formatHandlerErrorResponse` to eliminate raw JSON array exceptions escaping the execution sandbox. Remedied property leakage in backup, restore, and data-transfer tools by replacing `hint` with the standardized `suggestion` property. Fixed remaining property leakages by migrating `protocol` in `mysqlsh_import_json` and process-state fields (`language`, `exitCode`, `stdout`, `stderr`) in `mysqlsh_run_script` into the `details` object during domain errors.
- Fixed `killQuery` dropping positional arguments by adding it to `POSITIONAL_PARAM_MAP` and updated `formatZodError` to include parameter paths in Zod error messages.
- Reduced default token payloads for monitoring tools by defaulting `summary` to `true` in `mysql_innodb_status` and reducing the default `limit` to 30 in `mysql_show_status` and `mysql_show_variables`.
- Fixed docstore tool group filter inconsistencies by migrating `mysql_doc_find` to use `parseDocFilter`, ensuring query parity with `doc_modify` and `doc_remove` when passing direct `_id` values or `field=value` expressions.
- Fixed docstore tool group to support empty filter objects/strings (`{}`) in `mysql_doc_find`, converting them to undefined to return all documents without throwing Zod or SQL validation errors.
- Fixed fulltext search tool group SQL generation by removing the hardcoded `id` column requirement from the SELECT clause, allowing FULLTEXT operations on tables without an `id` primary key.
- Fixed introspection tool group by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for circular dependency detection. Replaced hardcoded exceptions with standardized domain errors in `mysql_topological_sort` and integrated `circular_dependency` checks into `mysql_constraint_analysis`.
- Fixed `formatHandlerErrorResponse` inadvertently stripping structured error properties (`code`, `category`, `suggestion`, `recoverable`) from `MySQLMcpError` returns, ensuring 100% adherence to the `ErrorResponse` schema globally.
- Fixed `mysql_dependency_graph` failing to truncate early by implementing active `maxDepth` traversal filtering in the graph construction phase and exposing `maxDepth` in its Zod schema.
- Fixed `json` tool group error handling by enforcing strict adherence to the `ErrorResponse` schema (`{ success: boolean }`) for all handlers. Replaced legacy property leakages on informational fields (`note`) with standard domain properties (`suggestion`) in `mysql_json_insert` and `mysql_json_index_suggest`. Added `path` as an accepted alias parameter for `paths` in `mysql_json_remove` to improve Code Mode compatibility, and validated robust handling of empty string payloads in `mysql_json_validate`. Certified `json` tool group via comprehensive Code Mode stress testing, validating deep object mutation workflows, array subset manipulation, payload efficiency (`metrics.tokenEstimate`), and edge-case resilience.
- Fixed `migration` tool group by enforcing strict validation of conflicting schema hashes across identical versions in `mysql_migration_apply` and correctly flagging out-of-order executions in `mysql_migration_history`. Certified migration tool group via advanced Code Mode stress testing.
- Fixed spatial tool group WKT round-tripping for SRID 4326 by explicitly requesting `'axis-order=long-lat'` in all `ST_AsText` output queries in `geometry.ts`, `queries.ts`, and `operations.ts`. Certified spatial tool group via advanced Code Mode stress testing.
- Fixed `performance` anomaly tools by updating input validation to emit strict structured errors for out-of-bounds parameters and accurately reflect alias usage (`minExecutions`, `thresholdPercent`). Certified `performance` tool group via advanced Code Mode stress testing.
- Fixed `stats` tool group boundary validation by enforcing numeric type checking in `mysql_stats_percentiles`, enforcing a minimum bucket count of 1 for `mysql_stats_histogram`, and a maximum bucket count of 500 for `mysql_stats_distribution`. Certified `stats` tool group via advanced Code Mode stress testing.

## Security

- Fixed a vulnerability where HTTP transports validated tokens but bypassed tool-specific scope enforcement.
- Updated `hono` to `4.12.9` to patch SSE control field, cookie attribute injection, and prototype pollution.
- Updated `flatted`, `path-to-regexp`, `picomatch`, `express-rate-limit`, and `@hono/node-server` to patch ReDoS, prototype pollution, and bypass vulnerabilities.
- Updated `tar` and `minimatch` in Dockerfile to patch npm-bundled dependency vulnerabilities.
- Pinned all GitHub Actions by SHA, added TruffleHog + Gitleaks secret scanning, and integrated SLSA Build L3 attestation via `--provenance`.
- Repositioned Trivy vulnerability scanning to run before image pushes instead of after.

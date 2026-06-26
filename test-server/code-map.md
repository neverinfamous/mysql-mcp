# mysql-mcp Code Map

> **Agent-optimized navigation reference.** Read this before searching the codebase. Covers directory layout, handler→tool mapping, type/schema locations, error hierarchy, and key constants.
>
> Last updated: April 27, 2026

---

## Directory Tree

```
src/
├── cli.ts                          # CLI entry point (legacy, calls cli/args/index.ts)
├── index.ts                        # Barrel re-export for library consumers
│
├── cli/
│   └── args/                       # Argument parsing, transport/auth/stateless/trustProxy selection
│
├── server/
│   └── mcp-server/                 # McpServer setup, adapter registration, tool/resource/prompt wiring
│
├── types/                          # Core TypeScript types (barrel: types/index.ts)
│   ├── index.ts                    # Barrel — also re-exports error classes from modules/errors.ts
│   └── modules/
│       ├── database.ts             # DatabaseConfig, MySQLOptions, PoolConfig, ConnectionPoolConfig,
│       │                           #   PoolStats, HealthStatus, initializationSql
│       ├── query.ts                # QueryResult, ColumnInfo, FieldInfo, TableInfo, SchemaInfo, IndexInfo,
│       │                           #   ConstraintInfo, RoutineInfo, TriggerInfo
│       ├── server.ts               # TransportType, McpServerConfig (authToken, stateless, trustProxy)
│       ├── oauth.ts                # OAuthConfig, OAuthScope, TokenClaims, RequestContext
│       ├── errors.ts               # MySQLMcpError base + 7 subclasses (see § Error Classes)
│       ├── error-types.ts          # ErrorCategory enum (9 categories), ErrorResponse interface, ErrorContext
│       └── tools.ts                # ToolGroup, MetaGroup, RouterConfig, MySQLShellConfig,
│                                   #   ToolFilterConfig, AdapterCapabilities, ToolDefinition,
│                                   #   ResourceDefinition, PromptDefinition
│
├── constants/
│   ├── server-instructions.ts      # Generated: slim INSTRUCTIONS constant (~634 chars) + HELP_CONTENT map (per-group help)
│   └── server-instructions/        # Source .md files for each help resource (26 files: overview, gotchas, core, json, etc.)
│
├── filtering/
│   ├── tool-constants.ts            # TOOL_GROUPS arrays, META_GROUPS shortcuts, group→tools map
│   └── tool-filter.ts               # ToolFilter class — parse/apply --tool-filter expressions
│
├── utils/
│   ├── logger.ts                   # Logger class (structured JSON, severity filtering)
│   ├── validators.ts               # SQL identifier validation/sanitization, input validators
│   └── prompt-generator.ts          # MCP prompt generation helpers
│
├── logging/
│   ├── mcp-logging.ts               # MCP protocol logging integration
│   └── index.ts                    # Barrel
│
├── pool/
│   └── connection-pool.ts           # MySQL connection pool manager (mysql2/promise), initializationSql support
│
├── progress/
│   ├── progress-reporter.ts         # MCP progress notification helpers
│   └── index.ts                    # Barrel
│
├── observability/                  # Metrics registry and persistence
│   ├── metrics.ts                  # In-memory metrics registry for MCP telemetry
│   └── system-db.ts                # SQLite persistence for metrics via better-sqlite3
│
├── audit/                          # Audit observability (interceptor, logger, backup manager)
│   ├── interceptor.ts              # AuditInterceptor — wraps tool handlers, scope-based filtering,
│   │                               #   tokenEstimate, redaction, OAuth identity capture
│   ├── logger.ts                   # AuditLogger — JSONL file I/O, buffered flush, rotation, recent()
│   └── backup-manager/             # BackupManager — pre-mutation DDL/data snapshots, diff, restore
│
├── auth/                           # OAuth 2.1 implementation (10 files)
│   ├── middleware.ts               # Express-style OAuth middleware
│   ├── token-validator.ts           # JWT/JWKS token validation
│   ├── scopes.ts                   # Scope parsing, enforcement
│   ├── scope-map.ts                # Tool→scope O(1) mapping (getRequiredScope(), getToolScopeMap())
│   ├── auth-context.ts             # Request context builder (AsyncLocalStorage)
│   ├── oauth-resource-server.ts      # RFC 9728 /.well-known/oauth-protected-resource
│   ├── authorization-server-discovery.ts  # RFC 8414 auth server metadata discovery
│   ├── errors.ts                   # OAuth-specific error classes
│   ├── types.ts                    # OAuth TypeScript types
│   └── index.ts                    # Barrel
│
├── transports/
│   ├── index.ts                    # Barrel
│   └── http/
│       ├── server.ts               # HTTP/SSE transport (Streamable HTTP + legacy SSE + bearer auth + stateless mode
│       │                           #   + OAuth scope enforcement on tools/call for both transports)
│       ├── handlers.ts             # Route handlers (POST /mcp, GET /sse, health, etc.)
│       ├── security.ts             # Security headers, rate limiting, CORS, body parsing
│       ├── types.ts                # HTTP transport types (authToken, stateless)
│       └── index.ts                # Barrel
│
├── codemode/                       # Code Mode sandbox (secure JS execution)
│   ├── sandbox.ts                  # SandboxPool lifecycle manager
│   ├── sandbox-factory.ts          # Sandbox creation factory
│   ├── auto-return.ts              # Last-expression auto-return transform (IIFE helper)
│   ├── api/
│   │   ├── mysql-api/              # mysql.* API bridge — injects AuditInterceptor into all 28 groups
│   │   ├── constants/              # Code Mode method aliases, positional params, prefix rules
│   │   ├── generator.ts            # createGroupApi() — dynamic tool→method generator with audit wrapper
│   │   └── index.ts                # Barrel
│   ├── security.ts                 # Code validation (blocked patterns, injection prevention)
│   ├── types.ts                    # Sandbox TypeScript types
│   └── index.ts                    # Barrel
│
├── adapters/
│   ├── database-adapter/            # Abstract DatabaseAdapter base class module
│   │
│   └── mysql/                      # ── MySQL adapter (mysql2) ──
│       ├── mysql-adapter/           # MySQLAdapter module (extends DatabaseAdapter)
│       ├── schema-manager.ts        # Schema cache + metadata (TTL-based)
│       ├── schemas/                # Modular Zod schemas by tool group (e.g., core.ts, admin.ts)
│       ├── index.ts                # Barrel
│       ├── prompts/                # 13+ MCP prompts (see § below)
│       ├── resources/              # 19+ MCP resources (see § below)
│       └── tools/                  # Tool handler files (see § Handler Map below)
```

---

## Handler → Tool Mapping

241 tools across 28 groups. Each handler file registers tools with `group` labels.

<!-- BEGIN: TOOL_MAPPING -->
| Group | Tools |
| ----- | ----- |
| **admin** | `mysql_audit_search`, `mysql_append_insight`, `mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, `mysql_repair_table`, `mysql_flush_tables`, `mysql_kill_query`, `mysql_server_config` |
| **backup** | `mysql_audit_list_backups`, `mysql_audit_restore_backup`, `mysql_audit_diff_backup`, `mysql_export_table`, `mysql_import_data`, `mysql_create_dump`, `mysql_restore_dump` |
| **cluster** | `mysql_gr_status`, `mysql_gr_members`, `mysql_gr_primary`, `mysql_gr_transactions`, `mysql_gr_flow_control`, `mysql_cluster_instances`, `mysql_cluster_router_status`, `mysql_cluster_status`, `mysql_cluster_switchover`, `mysql_cluster_topology` |
| **codemode** | `mysql_execute_code` |
| **core** | `mysql_read_query`, `mysql_write_query`, `mysql_get_indexes`, `mysql_create_index`, `mysql_list_tables`, `mysql_describe_table`, `mysql_create_table`, `mysql_drop_table`, `mysql_enable_versioning`, `mysql_disable_versioning`, `mysql_check_version`, `mysql_conditional_update` |
| **docstore** | `mysql_doc_list_collections`, `mysql_doc_create_collection`, `mysql_doc_drop_collection`, `mysql_doc_collection_info`, `mysql_doc_find`, `mysql_doc_modify`, `mysql_doc_remove`, `mysql_doc_create_index` |
| **events** | `mysql_event_create`, `mysql_event_alter`, `mysql_event_drop`, `mysql_event_list`, `mysql_event_status`, `mysql_scheduler_status` |
| **fulltext** | `mysql_fulltext_boolean`, `mysql_fulltext_create`, `mysql_fulltext_drop`, `mysql_fulltext_expand`, `mysql_fulltext_search` |
| **introspection** | `mysql_constraint_analysis`, `mysql_migration_risks`, `mysql_cascade_simulator`, `mysql_dependency_graph`, `mysql_topological_sort`, `mysql_schema_snapshot` |
| **json** | `mysql_json_extract`, `mysql_json_set`, `mysql_json_insert`, `mysql_json_replace`, `mysql_json_remove`, `mysql_json_contains`, `mysql_json_keys`, `mysql_json_array_append`, `mysql_json_get`, `mysql_json_update`, `mysql_json_search`, `mysql_json_validate`, `mysql_json_diff`, `mysql_json_index_suggest`, `mysql_json_merge`, `mysql_json_normalize`, `mysql_json_stats` |
| **migration** | `mysql_migration_rollback`, `mysql_migration_history`, `mysql_migration_status`, `mysql_migration_init`, `mysql_migration_record`, `mysql_migration_apply` |
| **monitoring** | `mysql_server_health`, `mysql_innodb_status`, `mysql_pool_stats`, `mysql_show_processlist`, `mysql_replication_status`, `mysql_show_status`, `mysql_show_variables` |
| **optimization** | `mysql_index_recommendation`, `mysql_query_rewrite`, `mysql_force_index`, `mysql_optimizer_trace` |
| **partitioning** | `mysql_partition_info`, `mysql_add_partition`, `mysql_drop_partition`, `mysql_reorganize_partition` |
| **performance** | `mysql_buffer_pool_stats`, `mysql_explain_analyze`, `mysql_explain`, `mysql_index_usage`, `mysql_query_stats`, `mysql_slow_queries`, `mysql_table_stats`, `mysql_thread_stats`, `mysql_detect_query_anomalies`, `mysql_detect_bloat_risk`, `mysql_detect_connection_spike` |
| **proxysql** | `proxysql_users`, `proxysql_global_variables`, `proxysql_process_list`, `proxysql_query_rules`, `proxysql_query_digest`, `proxysql_commands`, `proxysql_servers`, `proxysql_connection_pool`, `proxysql_status`, `proxysql_runtime_status`, `proxysql_memory_stats` |
| **replication** | `mysql_master_status`, `mysql_slave_status`, `mysql_binlog_events`, `mysql_gtid_status`, `mysql_replication_lag` |
| **roles** | `mysql_role_assign`, `mysql_role_revoke`, `mysql_user_roles`, `mysql_role_create`, `mysql_role_drop`, `mysql_role_grants`, `mysql_role_grant`, `mysql_role_list` |
| **router** | `mysql_router_metadata_status`, `mysql_router_pool_status`, `mysql_router_route_status`, `mysql_router_route_health`, `mysql_router_route_connections`, `mysql_router_route_destinations`, `mysql_router_route_blocked_hosts`, `mysql_router_status`, `mysql_router_routes` |
| **schema** | `mysql_list_constraints`, `mysql_list_schemas`, `mysql_create_schema`, `mysql_drop_schema`, `mysql_list_stored_procedures`, `mysql_list_functions`, `mysql_list_events`, `mysql_list_triggers`, `mysql_list_views`, `mysql_create_view`, `mysql_drop_view` |
| **security** | `mysql_security_audit`, `mysql_security_firewall_status`, `mysql_security_firewall_rules`, `mysql_security_mask_data`, `mysql_security_user_privileges`, `mysql_security_sensitive_tables`, `mysql_security_ssl_status`, `mysql_security_encryption_status`, `mysql_security_password_validate` |
| **shell** | `mysqlsh_dump_instance`, `mysqlsh_dump_schemas`, `mysqlsh_dump_tables`, `mysqlsh_export_table`, `mysqlsh_import_table`, `mysqlsh_import_json`, `mysqlsh_version`, `mysqlsh_load_dump`, `mysqlsh_run_script`, `mysqlsh_check_upgrade` |
| **spatial** | `mysql_spatial_point`, `mysql_spatial_polygon`, `mysql_spatial_intersection`, `mysql_spatial_buffer`, `mysql_spatial_transform`, `mysql_spatial_geojson`, `mysql_spatial_distance`, `mysql_spatial_distance_sphere`, `mysql_spatial_contains`, `mysql_spatial_within`, `mysql_spatial_create_column`, `mysql_spatial_create_index` |
| **stats** | `mysql_stats_top_n`, `mysql_stats_distinct`, `mysql_stats_frequency`, `mysql_stats_summary`, `mysql_stats_correlation`, `mysql_stats_histogram`, `mysql_stats_regression`, `mysql_stats_descriptive`, `mysql_stats_distribution`, `mysql_stats_percentiles`, `mysql_stats_sampling`, `mysql_stats_time_series`, `mysql_stats_hypothesis`, `mysql_stats_outliers`, `mysql_stats_lag_lead`, `mysql_stats_moving_avg`, `mysql_stats_ntile`, `mysql_stats_rank`, `mysql_stats_row_number`, `mysql_stats_running_total` |
| **sysschema** | `mysql_sys_user_summary`, `mysql_sys_host_summary`, `mysql_sys_statement_summary`, `mysql_sys_wait_summary`, `mysql_sys_io_summary`, `mysql_sys_schema_stats`, `mysql_sys_innodb_lock_waits`, `mysql_sys_memory_summary` |
| **text** | `mysql_regexp_match`, `mysql_like_search`, `mysql_soundex`, `mysql_substring`, `mysql_concat`, `mysql_collation_convert` |
| **transactions** | `mysql_transaction_begin`, `mysql_transaction_commit`, `mysql_transaction_rollback`, `mysql_transaction_savepoint`, `mysql_transaction_release`, `mysql_transaction_rollback_to`, `mysql_transaction_execute` |
| **vector** | `mysql_vector_info`, `mysql_vector_create_index`, `mysql_vector_optimize`, `mysql_vector_stats`, `mysql_vector_search`, `mysql_vector_range_search`, `mysql_vector_hybrid_search`, `mysql_vector_store`, `mysql_vector_batch_store`, `mysql_vector_delete`, `mysql_vector_get` |

<!-- END: TOOL_MAPPING -->

---

## Zod Schemas & Types

mysql-mcp uses a decentralized schema architecture to maintain type safety and minimize bundle sizes:

| Directory                         | Contents                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `adapters/mysql/schemas/`         | Modular Zod input schemas grouped by domain (e.g., `core.ts`, `admin.ts`, `schema.ts`) |
| `adapters/mysql/schemas/index.ts` | Barrel export for all schema definitions                                               |

---

## Prompts (`src/adapters/mysql/prompts/`)

19 prompt definitions across specialized workflow files:

<!-- BEGIN: PROMPTS -->
| Prompt | Description |
| ------ | ----------- |
| `mysql_backup_strategy` | Design enterprise backup strategy with RTO/RPO planning |
| `mysql_setup_cluster` | Complete MySQL InnoDB Cluster and Group Replication setup guide |
| `mysql_setup_docstore` | Complete MySQL Document Store and X DevAPI setup guide |
| `mysql_setup_events` | Complete MySQL Event Scheduler setup and configuration guide |
| `mysql_database_health_check` | Comprehensive database health assessment workflow |
| `mysql_index_tuning` | Analyze and optimize database indexes |
| `mysql_setup_shell` | MySQL Shell setup and usage guide |
| `mysql_setup_proxysql` | Complete ProxySQL setup and configuration guide |
| `mysql_setup_replication` | MySQL replication setup and configuration guide |
| `mysql_setup_router` | Complete MySQL Router setup and configuration guide |
| `mysql_setup_spatial` | Complete MySQL Spatial/GIS setup and usage guide |
| `mysql_sys_schema_guide` | Complete MySQL sys schema usage guide for diagnostics and troubleshooting |

<!-- END: PROMPTS -->

---

## Resources (`src/adapters/mysql/resources/`)

19 data resources + 24+ help resources providing read-only metadata and agent guidance:

### Data Resources

<!-- BEGIN: RESOURCES -->
| URI | Name |
| --- | ---- |
| `mysql://capabilities` | Server Capabilities |
| `mysql://cluster` | Cluster Status |
| `mysql://docstore` | Document Store Collections |
| `mysql://events` | Scheduled Events |
| `mysql://health` | Database Health |
| `mysql://indexes` | Index Statistics |
| `mysql://innodb` | InnoDB Status |
| `mysql://insights` | Business Insights Memo |
| `mysql://locks` | Lock Contention |
| `mysql://performance` | Performance Metrics |
| `mysql://pool` | Connection Pool |
| `mysql://processlist` | Active Processes |
| `mysql://replication` | Replication Status |
| `mysql://schema` | Database Schema |
| `mysql://spatial` | Spatial Columns |
| `mysql://status` | Server Status |
| `mysql://sysschema` | sys Schema Diagnostics |
| `mysql://tables` | Table List |
| `mysql://variables` | Server Variables |

<!-- END: RESOURCES -->

### Audit Resource (registered dynamically by McpServer when `--audit-log` is set)

| URI             | Content                                                             |
| --------------- | ------------------------------------------------------------------- |
| `mysql://audit` | Recent forensic audit trail + token summary + backup snapshot stats |

### Help Resources (registered dynamically by McpServer)

| URI                    | Source                                           | Content                                                |
| ---------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `mysql://help`         | `server-instructions/overview.md` + `gotchas.md` | Gotchas, aliases, Code Mode API — always available     |
| `mysql://help/{group}` | `server-instructions/{group}.md`                 | Per-group tool reference — filtered by `--tool-filter` |

24 group-specific help resources (one per tool group). Only groups enabled by `--tool-filter` are registered.

---

## Error Class Hierarchy

All errors extend `MySQLMcpError` (defined in `src/types/modules/errors.ts`). Every tool returns an enriched `ErrorResponse` via `formatHandlerError()` — never raw MCP exceptions. `ErrorCategory` enum and `ErrorResponse` interface defined in `src/types/modules/error-types.ts`.

```
MySQLMcpError (modules/errors.ts)         code: string, category: ErrorCategory, details?: Record
├── ConnectionError       code: CONNECTION_ERROR       category: CONNECTION
├── PoolError             code: POOL_ERROR             category: CONNECTION  (accepts custom code)
├── QueryError            code: QUERY_ERROR            category: QUERY
├── AuthenticationError   code: AUTHENTICATION_ERROR   category: AUTHENTICATION
├── AuthorizationError    code: AUTHORIZATION_ERROR    category: AUTHORIZATION
├── ValidationError       code: VALIDATION_ERROR       category: VALIDATION
├── TransactionError      code: TRANSACTION_ERROR      category: QUERY
├── TimeoutError          code: TIMEOUT_ERROR        category: CONNECTION
├── RateLimitError        code: RATE_LIMIT_ERROR     category: CONNECTION
├── ConflictError         code: CONFLICT_ERROR       category: QUERY
└── ExtensionNotAvailableError  code: EXTENSION_MISSING  category: CONFIGURATION
```

**ErrorCategory object** (9 categories) — `src/types/modules/error-types.ts`:

```typescript
const ErrorCategory = {
  VALIDATION: "validation",
  CONNECTION: "connection",
  QUERY: "query",
  PERMISSION: "permission",
  CONFIGURATION: "config",
  RESOURCE: "resource",
  AUTHENTICATION: "authentication",
  AUTHORIZATION: "authorization",
  INTERNAL: "internal",
} as const;
```

**ErrorResponse interface** — `src/types/modules/error-types.ts` (returned by all handlers on failure):

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  category: ErrorCategory;
  recoverable: boolean;
  suggestion: string | undefined;
  details: Record<string, unknown> | undefined;
  metrics?: { tokenEstimate: number; [key: string]: number };
}
```

**Usage pattern** — all tool handlers:

```typescript
import { formatHandlerError } from "./core/error-helpers.js";

try {
  // ... tool logic
} catch (err) {
  return formatHandlerError(err); // Returns full ErrorResponse
}
```

**Error helpers** — `tools/core/error-helpers.ts`:

- `formatHandlerError(err)` — consolidated enriched `ErrorResponse` builder (handles `ZodError`, `MySQLMcpError`, generic `Error`). Returns full `ErrorResponse` with `category`, `code`, `recoverable`
- `formatMysqlError(err)` / `formatZodError(err)` — internal string cleaners (used by `formatHandlerError`)
- `stripErrorPrefix(msg)` — strips MySQL wire-protocol prefixes

**Admin maintenance helpers** — `tools/admin/maintenance.ts`:

- `extractMaintenanceError(rows)` — parses MySQL multi-row maintenance results for domain errors (e.g., table not found). Used by `optimize_table`, `analyze_table`, `check_table`, `repair_table` to correctly wrap errors instead of returning raw result objects

---

## Key Constants & Config

| What                               | Where                                     | Notes                                                                                                           |
| ---------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Server instructions (agent prompt) | `src/constants/server-instructions.ts`    | Generated: slim `INSTRUCTIONS` (~634 chars) + `HELP_CONTENT` map. Source: `server-instructions/*.md` (26 files) |
| Generator script                   | `scripts/generate-server-instructions.ts` | Reads per-group `.md` files → produces `server-instructions.ts`                                                 |
| Tool group arrays                  | `src/filtering/tool-constants.ts`         | `TOOL_GROUPS` map, `META_GROUPS` shortcuts                                                                      |
| Tool filter logic                  | `src/filtering/tool-filter.ts`            | `ToolFilter` class                                                                                              |
| Connection pool                    | `src/pool/connection-pool.ts`             | mysql2/promise pool wrapper                                                                                     |
| Progress reporter                  | `src/progress/progress-reporter.ts`       | MCP progress notification helpers                                                                               |
| Logger                             | `src/utils/logger.ts`                     | Structured logging with severity filtering                                                                      |
| Validators                         | `src/utils/validators.ts`                 | SQL identifier validation, input sanitization                                                                   |

---

## Architecture Patterns (Quick Reference)

| Pattern                     | Description                                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Structured Errors**       | Every tool returns enriched `ErrorResponse` via `formatHandlerError()` — never raw exceptions. Uses `ErrorCategory` enum (9 categories) and `ErrorResponse` interface from `error-types.ts`. All tools (including complex domain tools like performance optimizations) explicitly trap errors to return `{ success: false }` rather than leaking MCP exceptions. |
| **Adapter Pattern**         | `DatabaseAdapter` (abstract) → `MySQLAdapter`. Single adapter (no WASM/Native split).                                                                                                                                                                                                                                                                                                  |
| **Schema Cache**            | `SchemaManager` caches table/column metadata with configurable TTL. Auto-invalidates on DDL.                                                                                                                                                                                                                                                                                           |
| **Trace Pruning**           | `mysql_optimizer_trace` uses recursive `deepClean` to aggressively prune AST trace outputs, protecting the LLM from token exhaustion during complex query analysis.                                                                                                                                                                                                           |
| **Connection Pool**         | `ConnectionPool` wraps mysql2/promise. Managed lifecycle with health checks. Supports `initializationSql` for per-connection session variable setup.                                                                                                                                                                                                                                   |
| **Code Mode Bridge**        | `mysql.*` API runs inside a secure `isolated-vm` native C++ engine with smart result proxies to prevent missing `await` and destructuring errors. `transformAutoReturn()` prepends `return` to last expression statement (Node REPL semantics).                                                                                                                                                                                                 |
| **Tool Filtering**          | `ToolFilter` parses `--tool-filter` string → whitelist/blacklist. `codemode` auto-injected. Supports meta-groups (`starter`, `dba-monitor`, etc.).                                                                                                                                                                                                                                     |
| **Modular Schemas**         | All Zod schemas live in `adapters/mysql/schemas/` to keep bundle sizes optimized and isolate group dependencies.                                                                                                                                                                                                                                                                       |
| **Help Resources**          | Slim `INSTRUCTIONS` (~634 chars) + on-demand `mysql://help` resources replace old 53KB monolith. `mysql://help/{group}` filtered by `--tool-filter`.                                                                                                                                                                                                                                   |
| **Barrel Re-exports**       | Import from `./module/index.js` (with `.js` extension for ESM).                                                                                                                                                                                                                                                                                                                        |
| **Ecosystem Tools**         | Router, ProxySQL, Shell, Cluster tools connect to external services on alternate ports.                                                                                                                                                                                                                                                                                                |
| **OAuth Scope Enforcement** | Per-tool scope enforcement on `tools/call` JSON-RPC requests. Both Streamable HTTP (`/mcp`) and Legacy SSE (`/messages`) transports intercept and validate `requireToolScope`. Uses `scope-map.ts` for O(1) tool→scope lookup.                                                                                                                                                         |
| **Admin Maintenance**       | `optimize_table`, `analyze_table`, `check_table`, `repair_table` use `rawQuery` (not `executeQuery`) to avoid prepared-statement corruption of multi-result-set DDL responses. `extractMaintenanceError()` parses domain errors from multi-row results.                                                                                                                                |
| **Audit Observability**     | `AuditInterceptor` wraps all tool handlers (scope-based filtering, tokenEstimate, redaction). `AuditLogger` writes JSONL with buffered flush + rotation. `BackupManager` captures DDL/data snapshots before destructive ops. `getAuditInterceptor()` exposes interceptor to Code Mode bridge for 100% sandbox audit coverage. Activated via `--audit-log`, `--audit-backup` CLI flags. |

---

## Import Path Conventions

- All imports use **`.js` extension** (ESM requirement): `import { x } from "./foo/index.js"`
- Error classes: import from `../../types/index.js` (barrel re-export)
- Note: mysql-mcp uses **kebab-case filenames** (e.g., `schema-manager.ts`, `tool-filter.ts`)

---

## Test Infrastructure

| File / Directory                            | Purpose                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `test-server/README.md`                     | Agent testing orchestration doc                                      |
| `test-server/code-map.md`                   | This file — agent-optimized codebase navigation reference            |
| `test-server/test-seed.sql`                 | Primary seed DDL+DML (11 tables, ~400+ rows)                         |
| `scripts/reset-database.mjs`                | Reset script - drops + re-seeds `testdb`                             |
| `test-server/test-tools.md`                 | Entry-point protocol for manual agent testing                        |
| `test-server/test-tool-groups/`             | Basic functionality tests for all 28 tool groups                     |
| `test-server/test-codemode/`                | Code Mode functionality tests for all tool groups                    |
| `test-server/test-usability/`               | Usability, hallucination fuzzing, and prompt tuning via Code Mode    |
| `test-server/test-advanced/`                | Advanced stress tests using Code Mode (nesting, security, etc.)      |
| `test-server/test-advanced/test-codemode-sandbox.md`| Sandbox security testing for `isolated-vm` execution boundary            |
| `test-server/test-advanced/test-codemode-advanced-concurrency.md`| Code Mode connection pool and Promise.all() saturation stress tests      |
| `test-server/scripts/prompt-template.md`    | Standardized template for all test prompts                           |
| `test-server/scripts/standardize-prompts.js`| Script to rebuild all 84 test prompts using the standard template    |
| `test-server/test-prompts.md`               | Prompt testing plan (13 prompts)                                     |
| `test-server/test-resources.md`             | Resource testing plan (19+ data resources)                           |
| `scripts/README.md`                         | Agent-optimized cluster management reference                         |
| `scripts/reboot-cluster.ps1`                | InnoDB Cluster reboot after complete outage                          |
| `scripts/generate-server-instructions.ts`   | Generates `server-instructions.ts` from source `.md` files           |
| `src/__tests__/`                            | Vitest unit tests (top-level)                                        |
| `src/audit/audit-interceptor.test.ts`       | AuditInterceptor unit tests (13 tests)                               |
| `src/audit/audit-logger.test.ts`            | AuditLogger unit tests (15 tests)                                    |
| `src/audit/backup-manager.test.ts`          | BackupManager unit tests (23 tests)                                  |
| `src/adapters/mysql/tools/*/___tests__/`    | Per-group Vitest unit tests                                          |
| `tests/e2e/`                                | Playwright E2E tests (payload contracts, auth, stateless)            |
| `tests/e2e/audit-log.spec.ts`               | Audit log E2E tests (write/read scope, redact, resource, corruption) |
| `tests/e2e/audit-backup.spec.ts`            | Audit backup E2E tests (snapshot, diff, restore dryRun, disabled)    |
| `tests/e2e/audit-token-summary.spec.ts`     | Audit token summary E2E tests (aggregation accuracy)                 |
| `tests/e2e/audit-rotation-stress.spec.ts`   | Audit log rotation stress test (40 iterations, 5-file retention)     |

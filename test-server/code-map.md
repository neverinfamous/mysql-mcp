# mysql-mcp Code Map

> **Agent-optimized navigation reference.** Read this before searching the codebase. Covers directory layout, handler→tool mapping, type/schema locations, error hierarchy, and key constants.
>
> Last updated: April 23, 2026

---

## Directory Tree

```
src/
├── cli.ts                          # CLI entry point (legacy, calls cli/args.ts)
├── index.ts                        # Barrel re-export for library consumers
│
├── cli/
│   └── args.ts                     # Argument parsing, transport/auth/stateless/trustProxy selection
│
├── server/
│   └── mcp-server.ts                # McpServer setup, adapter registration, tool/resource/prompt wiring
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
│   ├── worker-sandbox.ts           # Worker thread sandbox (MessagePort RPC bridge)
│   ├── worker-script.ts            # Worker thread entry point (runs inside vm)
│   ├── api.ts                      # mysql.* API bridge (exposes 192 tools to sandbox) — 40KB
│   ├── security.ts                 # Code validation (blocked patterns, injection prevention)
│   ├── types.ts                    # Sandbox TypeScript types
│   └── index.ts                    # Barrel
│
├── adapters/
│   ├── database-adapter.ts          # Abstract DatabaseAdapter base class
│   │
│   └── mysql/                      # ── MySQL adapter (mysql2) ──
│       ├── mysql-adapter.ts         # MySQLAdapter class (extends DatabaseAdapter)
│       ├── schema-manager.ts        # Schema cache + metadata (TTL-based)
│       ├── types.ts                # Zod schemas + TS types for ALL tool groups — 72KB
│       ├── index.ts                # Barrel
│       ├── prompts/                # 13+ MCP prompts (see § below)
│       ├── resources/              # 18+ MCP resources (see § below)
│       ├── types/                  # Extended types for ecosystem tools
│       │   ├── proxysql-types.ts   # ProxySQL-specific types
│       │   ├── router-types.ts     # MySQL Router types
│       │   └── shell-types.ts      # MySQL Shell types
│       └── tools/                  # Tool handler files (see § Handler Map below)
```

---

## Handler → Tool Mapping

192 tools across 25 groups. Each handler file registers tools with `group` labels.

### Tool Handlers (`src/adapters/mysql/tools/`)

| Group | Handler File(s) | Tools | Description |
|-------|----------------|-------|-------------|
| **codemode** | `codemode/index.ts` | 1 | `mysql_execute_code` |
| **core** | `core.ts` | 8 | `read_query`, `write_query`, `list_tables`, `describe_table`, `create_table`, `drop_table`, `create_index`, `get_indexes` |
| | `core/error-helpers.ts` | — | Shared `formatHandlerError()` orchestrator (handles ZodError, MySQLMcpError, generic Error) |
| **schema** | `schema/management.ts` | 3 | `list_schemas`, `create_schema`, `drop_schema` |
| | `schema/views.ts` | 3 | `list_views`, `create_view` + 1 more |
| | `schema/routines.ts` | 2 | `list_stored_procedures`, `list_functions` |
| | `schema/triggers.ts` | 1 | `list_triggers` |
| | `schema/constraints.ts` | 1 | `list_constraints` |
| | `schema/scheduled_events.ts` | 1 | `list_events` |
| **transactions** | `transactions.ts` | 7 | `transaction_begin/commit/rollback/savepoint/release/rollback_to/execute` |
| **json** | `json/core.ts` | 8 | `json_extract`, `json_set`, `json_insert`, `json_replace`, `json_remove`, `json_contains`, `json_keys`, `json_array_append` |
| | `json/helpers.ts` | 4 | `json_get`, `json_update`, `json_search`, `json_validate` |
| | `json/enhanced.ts` | 5 | `json_merge`, `json_diff`, `json_normalize`, `json_stats`, `json_index_suggest` |
| **docstore** | `docstore.ts` | 9 | `doc_list_collections`, `doc_create_collection`, `doc_drop_collection`, `doc_find`, `doc_add`, `doc_modify`, `doc_remove`, `doc_create_index`, `doc_collection_info` |
| **text** | `text/processing.ts` | 6 | `regexp_match`, `like_search`, `soundex`, `substring`, `concat`, `collation_convert` |
| | `text/fulltext.ts` | 5 | `fulltext_create`, `fulltext_drop`, `fulltext_search`, `fulltext_boolean`, `fulltext_expand` |
| **stats** | `stats/descriptive.ts` | 5 | `stats_descriptive`, `stats_percentiles`, `stats_distribution`, `stats_time_series`, `stats_sampling` |
| | `stats/comparative.ts` | 3 | `stats_correlation`, `stats_regression`, `stats_histogram` |
| **performance** | `performance/analysis.ts` | 8 | `explain`, `explain_analyze`, `slow_queries`, `query_stats`, `index_usage`, `table_stats`, `buffer_pool_stats`, `thread_stats` |
| **optimization** | `performance/optimization.ts` | 4 | `index_recommendation`, `query_rewrite`, `force_index`, `optimizer_trace` |
| **admin** | `admin/maintenance.ts` | 6 | `optimize_table`, `analyze_table`, `check_table`, `repair_table`, `flush_tables`, `kill_query` (uses `extractMaintenanceError()` + `rawQuery` for DDL) |
| | `admin/monitoring.ts` | 7 | `show_processlist`, `show_status`, `show_variables`, `innodb_status`, `replication_status`, `pool_stats`, `server_health` |
| | `admin/backup.ts` | 4 | `export_table`, `import_data`, `create_dump`, `restore_dump` |
| **security** | `security/audit.ts` | 3 | `security_audit`, `security_firewall_status`, `security_firewall_rules` |
| | `security/data-protection.ts` | 3 | `security_mask_data`, `security_user_privileges`, `security_sensitive_tables` |
| | `security/encryption.ts` | 3 | `security_ssl_status`, `security_encryption_status`, `security_password_validate` |
| **roles** | `roles.ts` | 8 | `role_list/create/drop/grants/grant/assign/revoke`, `user_roles` |
| **spatial** | `spatial/setup.ts` | 2 | `spatial_create_column`, `spatial_create_index` |
| | `spatial/geometry.ts` | 2 | `spatial_point`, `spatial_polygon` |
| | `spatial/queries.ts` | 4 | `spatial_distance`, `spatial_distance_sphere`, `spatial_contains`, `spatial_within` |
| | `spatial/operations.ts` | 4 | `spatial_intersection`, `spatial_buffer`, `spatial_transform`, `spatial_geojson` |
| **replication** | `replication.ts` | 5 | `master_status`, `slave_status`, `binlog_events`, `gtid_status`, `replication_lag` |
| **partitioning** | `partitioning.ts` | 4 | `partition_info`, `add_partition`, `drop_partition`, `reorganize_partition` |
| **events** | `events.ts` | 6 | `event_create/alter/drop/list/status`, `scheduler_status` |
| **cluster** | `cluster/group-replication.ts` | 5 | `gr_status`, `gr_members`, `gr_primary`, `gr_transactions`, `gr_flow_control` |
| | `cluster/innodb-cluster.ts` | 5 | `cluster_status`, `cluster_instances`, `cluster_topology`, `cluster_router_status`, `cluster_switchover` |
| **router** | `router.ts` | 9 | `router_status/routes/route_status/route_health/route_connections/route_destinations/route_blocked_hosts/metadata_status/pool_status` |
| **proxysql** | `proxysql.ts` | 11 | `proxysql_status/servers/query_rules/query_digest/connection_pool/users/global_variables/runtime_status/memory_stats/commands/process_list` |
| **shell** | `shell/common.ts` | — | Shared MySQL Shell execution helpers |
| | `shell/info.ts` | 1 | `mysqlsh_version` |
| | `shell/backup.ts` | 3 | `mysqlsh_dump_instance/dump_schemas/dump_tables` |
| | `shell/restore.ts` | 1 | `mysqlsh_load_dump` |
| | `shell/data-transfer.ts` | 3 | `mysqlsh_export_table/import_table/import_json` |
| | `shell/utilities.ts` | 2 | `mysqlsh_check_upgrade`, `mysqlsh_run_script` |
| **sysschema** | `sysschema/resources.ts` | 3 | `sys_schema_stats`, `sys_innodb_lock_waits`, `sys_memory_summary` |
| | `sysschema/performance.ts` | 3 | `sys_statement_summary`, `sys_wait_summary`, `sys_io_summary` |
| | `sysschema/activity.ts` | 2 | `sys_user_summary`, `sys_host_summary` |

---

## Zod Schemas & Types

Unlike db-mcp (which has separate `output-schemas/`), mysql-mcp consolidates all Zod schemas in a single file:

| File | Size | Contents |
|------|------|----------|
| `adapters/mysql/types.ts` | **72KB** | All Zod input schemas for every tool group, parameter validation schemas, response types |
| `adapters/mysql/types/proxysql-types.ts` | 7.5KB | ProxySQL-specific types |
| `adapters/mysql/types/router-types.ts` | 4KB | MySQL Router types |
| `adapters/mysql/types/shell-types.ts` | 10KB | MySQL Shell types |

---

## Prompts (`src/adapters/mysql/prompts/`)

13 prompt definitions across specialized workflow files:

| File | Prompts |
|------|---------|
| `index.ts` | Barrel + `mysql_optimization`, `mysql_health_check` |
| `backup-strategy.ts` | `mysql_backup_strategy` |
| `cluster-setup.ts` | `mysql_cluster_setup` |
| `docstore-setup.ts` | `mysql_docstore_setup` |
| `event-scheduler.ts` | `mysql_event_scheduler` |
| `index-tuning.ts` | `mysql_index_tuning` |
| `mysqlsh-setup.ts` | `mysql_mysqlsh_setup` |
| `proxysql-setup.ts` | `mysql_proxysql_setup` |
| `replication-setup.ts` | `mysql_replication_setup` |
| `router-setup.ts` | `mysql_router_setup` |
| `spatial-setup.ts` | `mysql_spatial_setup` |
| `sys-schema.ts` | `mysql_sys_schema` |

---

## Resources (`src/adapters/mysql/resources/`)

18 data resources + 24+ help resources providing read-only metadata and agent guidance:

### Data Resources

| File | Resources |
|------|-----------|
| `schema.ts` | `mysql://schema` |
| `tables.ts` | `mysql://tables` |
| `indexes.ts` | `mysql://indexes` |
| `variables.ts` | `mysql://variables` |
| `status.ts` | `mysql://status` |
| `processlist.ts` | `mysql://processlist` |
| `health.ts` | `mysql://health` |
| `pool.ts` | `mysql://pool` |
| `capabilities.ts` | `mysql://capabilities` |
| `performance.ts` | `mysql://performance/{view}` (4 views) |
| `innodb.ts` | `mysql://innodb/{metric}` (4 metrics) |
| `replication.ts` | `mysql://replication/{view}` (4 views) |
| `locks.ts` | `mysql://locks` |
| `events.ts` | `mysql://events` |
| `cluster.ts` | `mysql://cluster/{view}` |
| `docstore.ts` | `mysql://docstore/{collection}` |
| `spatial.ts` | `mysql://spatial/{table}` |
| `sysschema.ts` | `mysql://sys/{view}` |

### Help Resources (registered dynamically by McpServer)

| URI | Source | Content |
|-----|--------|---------|
| `mysql://help` | `server-instructions/overview.md` + `gotchas.md` | Gotchas, aliases, Code Mode API — always available |
| `mysql://help/{group}` | `server-instructions/{group}.md` | Per-group tool reference — filtered by `--tool-filter` |

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
└── TransactionError      code: TRANSACTION_ERROR      category: QUERY
```

**ErrorCategory enum** (9 categories) — `src/types/modules/error-types.ts`:
```typescript
enum ErrorCategory {
  CONNECTION, QUERY, VALIDATION, AUTHENTICATION, AUTHORIZATION,
  RESOURCE, CONFIGURATION, TIMEOUT, UNKNOWN
}
```

**ErrorResponse interface** — `src/types/modules/error-types.ts` (returned by all handlers on failure):
```typescript
interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  category: ErrorCategory;
  recoverable: boolean;
  suggestion?: string;
  details?: Record<string, unknown>;
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

| What | Where | Notes |
|------|-------|-------|
| Server instructions (agent prompt) | `src/constants/server-instructions.ts` | Generated: slim `INSTRUCTIONS` (~634 chars) + `HELP_CONTENT` map. Source: `server-instructions/*.md` (26 files) |
| Generator script | `scripts/generate-server-instructions.ts` | Reads per-group `.md` files → produces `server-instructions.ts` |
| Tool group arrays | `src/filtering/tool-constants.ts` | `TOOL_GROUPS` map, `META_GROUPS` shortcuts |
| Tool filter logic | `src/filtering/tool-filter.ts` | `ToolFilter` class |
| Connection pool | `src/pool/connection-pool.ts` | mysql2/promise pool wrapper |
| Progress reporter | `src/progress/progress-reporter.ts` | MCP progress notification helpers |
| Logger | `src/utils/logger.ts` | Structured logging with severity filtering |
| Validators | `src/utils/validators.ts` | SQL identifier validation, input sanitization |

---

## Architecture Patterns (Quick Reference)

| Pattern | Description |
|---------|-------------|
| **Structured Errors** | Every tool returns enriched `ErrorResponse` via `formatHandlerError()` — never raw exceptions. Uses `ErrorCategory` enum (9 categories) and `ErrorResponse` interface from `error-types.ts`. |
| **Adapter Pattern** | `DatabaseAdapter` (abstract) → `MySQLAdapter`. Single adapter (no WASM/Native split). |
| **Schema Cache** | `SchemaManager` caches table/column metadata with configurable TTL. Auto-invalidates on DDL. |
| **Connection Pool** | `ConnectionPool` wraps mysql2/promise. Managed lifecycle with health checks. Supports `initializationSql` for per-connection session variable setup. |
| **Code Mode Bridge** | `mysql.*` API in worker thread communicates via MessagePort RPC to main thread handlers. `transformAutoReturn()` prepends `return` to last expression statement (Node REPL semantics). |
| **Tool Filtering** | `ToolFilter` parses `--tool-filter` string → whitelist/blacklist. `codemode` auto-injected. Supports meta-groups (`starter`, `dba-monitor`, etc.). |
| **Monolithic Types** | Unlike db-mcp's per-group output-schemas, all Zod schemas live in `adapters/mysql/types.ts` (72KB). |
| **Help Resources** | Slim `INSTRUCTIONS` (~634 chars) + on-demand `mysql://help` resources replace old 53KB monolith. `mysql://help/{group}` filtered by `--tool-filter`. |
| **Barrel Re-exports** | Import from `./module/index.js` (with `.js` extension for ESM). |
| **Ecosystem Tools** | Router, ProxySQL, Shell, Cluster tools connect to external services on alternate ports. |
| **OAuth Scope Enforcement** | Per-tool scope enforcement on `tools/call` JSON-RPC requests. Both Streamable HTTP (`/mcp`) and Legacy SSE (`/messages`) transports intercept and validate `requireToolScope`. Uses `scope-map.ts` for O(1) tool→scope lookup. |
| **Admin Maintenance** | `optimize_table`, `analyze_table`, `check_table`, `repair_table` use `rawQuery` (not `executeQuery`) to avoid prepared-statement corruption of multi-result-set DDL responses. `extractMaintenanceError()` parses domain errors from multi-row results. |

---

## Import Path Conventions

- All imports use **`.js` extension** (ESM requirement): `import { x } from "./foo/index.js"`
- Error classes: import from `../../types/index.js` (barrel re-export)
- Note: mysql-mcp uses **kebab-case filenames** (e.g., `mysql-adapter.ts`, `mcp-server.ts`)

---

## Test Infrastructure

| File / Directory | Purpose |
|-----------------|---------|
| `test-server/README.md` | Agent testing orchestration doc |
| `test-server/code-map.md` | This file — agent-optimized codebase navigation reference |
| `test-server/test-seed.sql` | Primary seed DDL+DML (11 tables, ~400+ rows) |
| `test-server/reset-database.ps1` | Reset script — drops + re-seeds `testdb` |
| `test-server/Tool-Reference.md` | Complete 192-tool inventory with descriptions |
| `test-server/test-agent-experience.md` | 35 open-ended scenarios — validates help resource sufficiency |
| `test-server/test-group-tools-core.md` | Core/transactions/schema group checklists |
| `test-server/test-group-tools-data.md` | JSON/fulltext/docstore/text/stats checklists |
| `test-server/test-group-tools-admin.md` | Admin/monitoring/perf/security/roles/backup checklists |
| `test-server/test-group-tools-ext.md` | Spatial/partitioning/events checklists |
| `test-server/test-group-tools-ecosystem.md` | Cluster/ProxySQL/Router/Shell checklists |
| `test-server/test-tools.md` | Entry-point protocol (schema ref, reporting format) |
| `test-server/test-prompts.md` | Prompt testing plan (13 prompts) |
| `test-server/test-resources.md` | Resource testing plan (18+ data resources) |
| `test-server/test-instruction-levels.mjs` | Integration test — slim instructions + help resource filtering |
| `test-server/advanced-test-tools.md` | Stress tests (boundary, concurrency, cross-group) |
| `scripts/README.md` | Agent-optimized cluster management reference |
| `scripts/reboot-cluster.ps1` | InnoDB Cluster reboot after complete outage |
| `scripts/generate-server-instructions.ts` | Generates `server-instructions.ts` from source `.md` files |
| `src/__tests__/` | Vitest unit tests (top-level) |
| `src/adapters/mysql/tools/*/___tests__/` | Per-group Vitest unit tests |
| `tests/e2e/` | Playwright E2E tests (payload contracts, auth, stateless) |

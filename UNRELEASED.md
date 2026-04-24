# Unreleased

### Security

- **Dependency Vulnerability Fixes**:
  - Updated `flatted` to `3.4.2` to fix Prototype Pollution via `parse()` (GHSA Dependabot #23/#71).
  - Updated `hono` to `4.12.9` to fix SSE control field injection, cookie attribute injection, and prototype pollution vulnerabilities (#77).
  - Updated `path-to-regexp` to `8.4.0` to fix Regular Expression Denial of Service via sequential optional groups and multiple wildcards (#28/#79).
  - Updated `picomatch` to `4.0.4` to fix Method Injection in POSIX Character Classes (#25/#78).
  - Bumped Dockerfile `tar` patch from `7.5.12` → `7.5.13` (CVE-2026-26960 extended coverage for npm bundled copy).
  - Updated `hono` to `4.12.8` to fix multiple vulnerabilities (CVE-2025-27103, CVE-2025-27104, CVE-2025-27110, CVE-2025-27105).
  - Updated `express-rate-limit` to `8.3.1` to fix IPv4-mapped IPv6 address bypass vulnerability.
  - Updated `@hono/node-server` to `1.19.11` to fix authorization bypass for protected static paths.
  - Pinned exact versions for `tar` (`7.5.12`) and `minimatch` (`10.2.4`) in the `Dockerfile` to patch npm bundled dependencies.
- **CI/CD Hardening**: Added `--provenance` flag to `npm publish` in `publish-npm.yml` for SLSA Build L3 attestation. Added `id-token: write` permission for OIDC provenance token generation.
- **CI/CD Harmonization**:
  - SHA-pinned all GitHub Actions across all workflow files (was using tag-based `@v6`/`@v7` refs)
  - Added standalone `lint-and-test.yml` workflow (Node 24+25 matrix, lint, typecheck, build, test, npm audit)
  - Added `secrets-scanning.yml` (TruffleHog + Gitleaks on every push/PR)
  - Added `dependabot-auto-merge.yml` (auto-squash patch/minor, manual review for major)
  - Restructured `docker-publish.yml`: security scan now runs before push (was after), added Trivy+SARIF upload, switched trigger from `tags: [v*]` to `workflow_run` (after lint-and-test), removed inline quality-gate and codeql jobs (now standalone)
  - Added `.gitleaks.toml` and `.trivyignore` configuration files
  - Harmonized CodeQL to use `security-extended,security-and-quality` query sets with paths filter
- **OAuth Scope Enforcement (Security Fix)**: Addressed a security gap where OAuth authentication was validating tokens but not enforcing tool-specific scopes during `tools/call` JSON-RPC requests via the HTTP transport. Both Streamable HTTP (`/mcp`) and Legacy SSE (`/messages`) transports now intercept request bodies and strictly enforce `requireToolScope` for the requested tool before delegating to the MCP SDK.

## Changed

- **Modular Schema Architecture**: Decentralized the monolithic `adapters/mysql/types.ts` (72KB) into modular, group-specific schemas within `adapters/mysql/schemas/`. This drastically improves maintainability, isolates domain dependencies, and optimizes build performance.
- **Code Mode API Expansion**: Integrated `introspection` and `migration` tool groups into the `MysqlApi` class, securely surfacing them to the sandbox. Hardened `createSandboxBindings` to automatically stub out write-methods (e.g., `mysql_migration_apply`) when running in `readonly: true` mode.
- **Dependency Updates**:
  - `@modelcontextprotocol/sdk` bumped to `1.29.0`
  - `typescript-eslint` bumped to `8.59.0`
  - `vitest` and `@vitest/coverage-v8` bumped to `4.1.5`
  - `@types/node` bumped to `25.6.0`
  - `eslint` bumped to `10.2.1`
  - `@playwright/test` bumped to `1.59.1`
  - `globals` bumped to `17.5.0`
  - `typescript` bumped to `6.0.3`
  - `jose` bumped to `6.2.2`
  - `mysql2` bumped to `3.22.2`
  - Updated Docker build actions (`build-push-action`, `setup-buildx-action`, `login-action`) to their latest major versions.
- **Help Resource Architecture**: Replaced 53KB monolithic `ServerInstructions.ts` with slim `INSTRUCTIONS` constant (~634 chars) + on-demand `mysql://help` resources. Agent instructions are now ~95% smaller; detailed tool reference is available via `mysql://help` (always) and `mysql://help/{group}` (filtered by `--tool-filter`).

## Added

- **Token Burn-Rate Estimation (`_meta.tokenEstimate`)**: Every tool response now includes `_meta.tokenEstimate` in `content[].text` using a ~4 bytes/token heuristic. Code Mode responses include `metrics.tokenEstimate` for sandbox results. `structuredContent` stays schema-pure (no injection). Enables agents to monitor token consumption per tool call.
- **Error Auto-Refinement (`findSuggestion()`)**: New `src/utils/error-suggestions.ts` maps ~30 common MySQL error patterns (wire-protocol codes 1146, 1054, 1062, 1064, etc.) to actionable suggestions and specific error codes. `MySQLMcpError` constructor now auto-detects suggestions and refines generic codes (e.g., `QUERY_ERROR` → `TABLE_NOT_FOUND`, `COLUMN_NOT_FOUND`, `DUPLICATE_KEY`).
- **New Tool Groups**: Added **Introspection** (6 tools for dependency mapping, topological sort, cascade simulation, schema snapshots, constraint analysis, and risk assessment) and **Migration** (6 tools for tracking, applying, and rolling back schema versions). Tool count: 193 → **205**.
- **Insights Subsystem**: New `mysql_append_insight` tool (admin group) and `mysql://insights` resource. In-memory `InsightsManager` singleton accumulates business insights during database analysis sessions and synthesizes them into a formatted memo. Tool count: 192 → **193**. Resource count: 18 → **19**.
- **Benchmark Suite**: 3 Vitest bench files measuring Code Mode sandbox performance, resource/prompt assembly, and tool-filter parsing throughput. Run via `pnpm run bench`.
- **Help Resources**: 24 group-specific help resources (`mysql://help/{group}`) registered dynamically based on tool filter configuration, plus `mysql://help` (gotchas, aliases, Code Mode API) always available.
- **Generator Script**: `scripts/generate-server-instructions.ts` reads per-group `.md` files and produces `server-instructions.ts` with `INSTRUCTIONS` + `HELP_CONTENT` exports.
- **Agent Experience Test**: `test-server/test-agent-experience.md` — 35 open-ended scenarios across 8 passes validating help resource sufficiency for cold-start agent operation.
- **Test Files Tracked**: `.gitignore` updated to track test documentation (`.md`, `.mjs`, `.ps1`, `.sql`) while ignoring only runtime files.
- **Cluster Reboot Script**: `scripts/reboot-cluster.ps1` — convenience PowerShell script to reboot InnoDB Cluster from complete outage (machine reboot).
- **Connection Pool Initialization (`initializationSql`)**: Added new `initializationSql` configuration property to `ConnectionPoolConfig` (PR #94, courtesy of @rsh2k1-2026). Allows defining an array of SQL statements that will be executed exactly once per connection when it is first checked out of the pool. Ensures per-connection session variables (e.g. `SET SESSION max_execution_time`) are reliably applied even when connections are rotated or recreated.

## Fixed

- **Backup Export Format Validation**: Relaxed the Zod schema for `mysql_export_table`'s `format` parameter to accept case-insensitive values (`"csv"`, `"sql"`), transforming them to uppercase before execution. Prevents valid user inputs from triggering strict validation rejections.
- **Performance Test Stability**: Relaxed strict millisecond timing assertions (`< 0.1ms`) in `src/__tests__/perf.test.ts` for O(1) group lookup verification to `< 0.5ms` to prevent flaky failures in CI and high-load environments.
- **Zod Validation Error Formatting**: Updated `formatZodError` in `src/adapters/mysql/tools/core/error-helpers.ts` to explicitly prepend the `"Validation error: "` prefix to the extracted validation issues. This ensures all tools maintain consistent structured validation response formats, satisfying cross-server verification standards.
- **Backup Tools Schema Validation**: Updated schemas for `mysql_create_dump` and `mysql_restore_dump` to enforce `database` as a required parameter, removing its optional default. This ensures correct Zod validation rejection (`{ success: false, error: "Validation error: ..." }`) when empty configurations are passed in Code Mode. Additionally, added explicit `success: true` returns to all happy-path responses in the backup toolset to strictly align with the project's structured response pattern.
- **Backup Tool Error Responses**: Refactored `mysql_export_table` and `mysql_import_data` to return fully populated, standard `ErrorResponse` objects (e.g., `{ success: false, error: "..." }`) instead of raw `{ exists: false }` payloads when encountering domain errors (like nonexistent tables). This ensures adherence to Pattern P154 (Object Existence Verification) and strict structured error standards.
- **Backup Tool Prefix Stripping**: Fixed an issue where `mysql_export_table` domain errors retained the raw MySQL wire-protocol prefix (`Query failed: Execute failed: `) by modifying `formatHandlerErrorResponse` to strip `MySQLMcpError` messages globally.
- **Backup Data Import Responses**: Refactored `mysql_import_data` to ensure returned domain errors incorporate the centralized `ErrorResponse` schema with `rowsInserted` attached, rather than using raw unstructured objects missing required categorization fields.
- **Admin Maintenance Error Handling**: Updated `mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, and `mysql_repair_table` tools to correctly parse and extract MySQL domain errors (e.g., table not found) from multi-row result sets. Domain errors are now correctly wrapped and returned as `{ success: false, error: "..." }` instead of returning the raw results object.
- **Admin Domain Errors Structured Format**: Modified the domain error extraction in the Admin tool group (via `extractMaintenanceError`, `flushTables`, and `killQuery`) to return the fully populated `ErrorResponse` structure (`code`, `category`, `recoverable`, `details`). Previously, domain errors returned partial objects missing these fields, causing type-compliance issues with the system's central error interfaces.
- **Admin DDL Result Parsing**: Switched `mysql_optimize_table`, `mysql_analyze_table`, `mysql_repair_table` from `executeQuery` to `rawQuery` — prevents mysql2 prepared-statement fallback from corrupting multi-result-set admin DDL responses. Matches `mysql_check_table`'s existing pattern.
- **Multi-Result-Set Handling**: Hardened `processExecutionResult` to detect mysql2 nested arrays (multi-result-set) and ResultSetHeader-in-array edge cases from `query()` fallback.
- **InnoDB Cluster Persistence**: Changed `group_replication_start_on_boot` from OFF to ON in `innodb-cluster.yml` and all `.cnf` files — cluster now auto-recovers from partial outages without manual MySQL Shell intervention.
- **E2E Read-Only Detection**: 5 write-dependent e2e payload tests (`optimize_table`, `analyze_table`, `write_query`, `create_table`, `create_index`) now detect `--super-read-only` and skip gracefully instead of failing.
- **Code Mode last-expression auto-return** — Bare expressions like `mysql.help()` now correctly surface their return value from `mysql_execute_code`. Previously, the async IIFE wrapper silently returned `undefined` for non-`return` statements. New `transformAutoReturn()` utility prepends `return` to the last expression statement, mimicking Node REPL semantics. Applied to both VM and Worker sandbox paths.
- **Benchmark Watch Mode**: Fixed the `bench` script in `package.json` hanging in watch mode by adding the `--run` flag to `vitest bench`, ensuring the CI/test workflow finishes successfully.

## Removed

- **Instruction Levels**: Removed `ServerInstructions.ts` monolith, `generateInstructions()`, `filterInstructionsByGroup()`, and `SECTION_GROUP_MAP`.

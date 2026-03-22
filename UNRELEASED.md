# Unreleased

### Security
- **Dependency Vulnerability Fixes**:
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

## Changed
- **Dependency Updates**:
  - `eslint` bumped to `10.1.0`
  - `typescript-eslint` bumped to `8.57.1`
  - `jose` bumped to `6.2.2`
  - `mysql2` bumped to `^3.20.0`
  - `vitest` and `@vitest/coverage-v8` bumped to `^4.1.0`
  - `@types/node` bumped to `^25.5.0`
  - Updated Docker build actions (`build-push-action`, `setup-buildx-action`, `login-action`) to their latest major versions.
- **Help Resource Architecture**: Replaced 53KB monolithic `ServerInstructions.ts` with slim `INSTRUCTIONS` constant (~634 chars) + on-demand `mysql://help` resources. Agent instructions are now ~95% smaller; detailed tool reference is available via `mysql://help` (always) and `mysql://help/{group}` (filtered by `--tool-filter`).

## Added
- **Help Resources**: 24 group-specific help resources (`mysql://help/{group}`) registered dynamically based on tool filter configuration, plus `mysql://help` (gotchas, aliases, Code Mode API) always available.
- **Generator Script**: `scripts/generate-server-instructions.ts` reads per-group `.md` files and produces `server-instructions.ts` with `INSTRUCTIONS` + `HELP_CONTENT` exports.
- **Agent Experience Test**: `test-server/test-agent-experience.md` — 35 open-ended scenarios across 8 passes validating help resource sufficiency for cold-start agent operation.
- **Test Files Tracked**: `.gitignore` updated to track test documentation (`.md`, `.mjs`, `.ps1`, `.sql`) while ignoring only runtime files.
- **Cluster Reboot Script**: `scripts/reboot-cluster.ps1` — convenience PowerShell script to reboot InnoDB Cluster from complete outage (machine reboot).

## Fixed
- **Admin DDL Result Parsing**: Switched `mysql_optimize_table`, `mysql_analyze_table`, `mysql_repair_table` from `executeQuery` to `rawQuery` — prevents mysql2 prepared-statement fallback from corrupting multi-result-set admin DDL responses. Matches `mysql_check_table`'s existing pattern.
- **Multi-Result-Set Handling**: Hardened `processExecutionResult` to detect mysql2 nested arrays (multi-result-set) and ResultSetHeader-in-array edge cases from `query()` fallback.
- **InnoDB Cluster Persistence**: Changed `group_replication_start_on_boot` from OFF to ON in `innodb-cluster.yml` and all `.cnf` files — cluster now auto-recovers from partial outages without manual MySQL Shell intervention.
- **E2E Read-Only Detection**: 5 write-dependent e2e payload tests (`optimize_table`, `analyze_table`, `write_query`, `create_table`, `create_index`) now detect `--super-read-only` and skip gracefully instead of failing.
- **Code Mode last-expression auto-return** — Bare expressions like `mysql.help()` now correctly surface their return value from `mysql_execute_code`. Previously, the async IIFE wrapper silently returned `undefined` for non-`return` statements. New `transformAutoReturn()` utility prepends `return` to the last expression statement, mimicking Node REPL semantics. Applied to both VM and Worker sandbox paths.

## Removed
- **Instruction Levels**: Removed `ServerInstructions.ts` monolith, `generateInstructions()`, `filterInstructionsByGroup()`, and `SECTION_GROUP_MAP`.


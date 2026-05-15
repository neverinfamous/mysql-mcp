# Unreleased

## Security

- Resolved XSS vulnerability in `ip-address` and `express-rate-limit` via npm update
- Bumped `tar` (bundled in npm) to `7.5.15` in Dockerfile to address CVE-2026-26960

## Added

## Changed

- Validated `sys` tool group payload efficiency and sequential stability through advanced stress tests.
**Dependency Updates**

- Bumped `@playwright/test` from `1.59.1` to `1.60.0`
- Bumped `@types/node` from `25.6.0` to `25.8.0`
- Bumped `@vitest/coverage-v8` from `4.1.5` to `4.1.6`
- Bumped `typescript-eslint` from `8.59.2` to `8.59.3`
- Bumped `vitest` from `4.1.5` to `4.1.6`
- Bumped `actions/download-artifact` to `v8.0.1`
- Bumped `aquasecurity/trivy-action` to `v0.36.0`
- Bumped `actions/setup-node` to `v6.4.0`
- Bumped `docker/build-push-action` to `v7.1.0`
- Bumped `github/codeql-action` to `v4.35.4`

## Fixed

- Updated Code Mode help examples for the `sys` group to use the friendly `mysql.sys` alias instead of `mysql.sysschema` to improve agent UX.
- Optimized payload size for stats tools (window functions and sampling) by reducing default limits from 20/100 to 10 to conserve context tokens.
- Migrated `binlog_events` empty string validation into the Zod schema for better error consistency and removed redundant handler checks.
- Capped `binlog_events` limit to 50 in Zod schema to prevent context window payload exhaustion during point-in-time recovery tracking.

### Removed

- Legacy skipped postgres-ported tests from the E2E suite to improve codebase hygiene

### Removed

- Legacy skipped postgres-ported tests from the E2E suite to improve codebase hygiene

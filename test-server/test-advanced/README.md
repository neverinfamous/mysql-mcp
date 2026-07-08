# MySQL MCP Advanced Code Mode Testing Suite

**🤖 AGENT INSTRUCTIONS**

This directory contains advanced stress tests for the tool groups. These tests simulate complex edge cases using exclusively Code Mode.

## Meet Fast Prerequisites

1. Basic deterministic tool group checklists in `../test-codemode/*.md` MUST pass first.
2. The testing database MUST be freshly seeded or reset. Run `node ../../scripts/reset-database.mjs` to ensure deterministic results.

## Understand Execution Parts

The original monolithic advanced stress testing suite was split into granular parts. This preserves agent attention spans and prevents LLM context window exhaustion. Each file strictly tests one major domain or cross-domain group.

- `test-codemode-advanced-admin-control-part1.md`
- `test-codemode-advanced-admin-control-part2.md`
- `test-codemode-advanced-admin-maintenance-part1.md`
- `test-codemode-advanced-admin-maintenance-part2.md`
- `test-codemode-advanced-backup-audit-part1.md`
- `test-codemode-advanced-backup-audit-part2.md`
- `test-codemode-advanced-backup-export.md`
- `test-codemode-advanced-cluster-group-replication-part1.md`
- `test-codemode-advanced-cluster-group-replication-part2.md`
- `test-codemode-advanced-cluster-innodb-part1.md`
- `test-codemode-advanced-cluster-innodb-part2.md`
- `test-codemode-advanced-concurrency.md`
- `test-codemode-advanced-core-part1a.md`
- `test-codemode-advanced-core-part1b.md`
- `test-codemode-advanced-core-part2a.md`
- `test-codemode-advanced-docstore-collections-part1.md`
- `test-codemode-advanced-docstore-collections-part2.md`
- `test-codemode-advanced-docstore-documents-part1.md`
- `test-codemode-advanced-docstore-documents-part2.md`
- `test-codemode-advanced-events-part1.md`
- `test-codemode-advanced-events-part2.md`
- `test-codemode-advanced-fulltext-part1.md`
- `test-codemode-advanced-fulltext-part2.md`
- `test-codemode-advanced-introspection-part1.md`
- `test-codemode-advanced-introspection-part2.md`
- `test-codemode-advanced-json-core-part1a.md`
- `test-codemode-advanced-json-core-part1b.md`
- `test-codemode-advanced-json-core-part2a.md`
- `test-codemode-advanced-json-core-part2b.md`
- `test-codemode-advanced-json-enhanced-part1.md`
- `test-codemode-advanced-json-enhanced-part2.md`
- `test-codemode-advanced-json-helpers.md`
- `test-codemode-advanced-migration-part1.md`
- `test-codemode-advanced-migration-part2.md`
- `test-codemode-advanced-monitoring-health-part1.md`
- `test-codemode-advanced-monitoring-health-part2.md`
- `test-codemode-advanced-monitoring-status.md`
- `test-codemode-advanced-optimization-part1.md`
- `test-codemode-advanced-optimization-part2.md`
- `test-codemode-advanced-partitioninga.md`
- `test-codemode-advanced-partitioningb.md`
- `test-codemode-advanced-performance-analysis-part1a.md`
- `test-codemode-advanced-performance-analysis-part1b.md`
- `test-codemode-advanced-performance-analysis-part2a.md`
- `test-codemode-advanced-performance-analysis-part2b.md`
- `test-codemode-advanced-performance-anomaly.md`
- `test-codemode-advanced-proxysql-config-part1.md`
- `test-codemode-advanced-proxysql-config-part2.md`
- `test-codemode-advanced-proxysql-status-part1.md`
- `test-codemode-advanced-proxysql-status-part2.md`
- `test-codemode-advanced-replication-part1.md`
- `test-codemode-advanced-replication-part2.md`
- `test-codemode-advanced-roles-assignment-part1.md`
- `test-codemode-advanced-roles-assignment-part2.md`
- `test-codemode-advanced-roles-management-part1.md`
- `test-codemode-advanced-roles-management-part2.md`
- `test-codemode-advanced-router-advanced-part1.md`
- `test-codemode-advanced-router-advanced-part2.md`
- `test-codemode-advanced-router-routes-part1.md`
- `test-codemode-advanced-router-routes-part2.md`
- `test-codemode-advanced-schema-management.md`
- `test-codemode-advanced-schema-routines.md`
- `test-codemode-advanced-schema-triggers.md`
- `test-codemode-advanced-schema-views.md`
- `test-codemode-advanced-security-audit-part1.md`
- `test-codemode-advanced-security-audit-part2.md`
- `test-codemode-advanced-security-system-part1.md`
- `test-codemode-advanced-security-system-part2.md`
- `test-codemode-advanced-sessions.md`
- `test-codemode-advanced-shell-data-part1.md`
- `test-codemode-advanced-shell-data-part2.md`
- `test-codemode-advanced-shell-utils-part1a.md`
- `test-codemode-advanced-shell-utils-part1b.md`
- `test-codemode-advanced-shell-utils-part2.md`
- `test-codemode-advanced-spatial-geometry.md`
- `test-codemode-advanced-spatial-operations.md`
- `test-codemode-advanced-spatial-queries.md`
- `test-codemode-advanced-spatial-setup.md`
- `test-codemode-advanced-stats-advanced-part1.md`
- `test-codemode-advanced-stats-advanced-part2.md`
- `test-codemode-advanced-stats-descriptive-part1.md`
- `test-codemode-advanced-stats-descriptive-part2.md`
- `test-codemode-advanced-stats-time-series-part1.md`
- `test-codemode-advanced-stats-time-series-part2.md`
- `test-codemode-advanced-stats-window-part1.md`
- `test-codemode-advanced-stats-window-part2.md`
- `test-codemode-advanced-sys-part1a.md`
- `test-codemode-advanced-sys-part1b.md`
- `test-codemode-advanced-sys-part2a.md`
- `test-codemode-advanced-sys-part2b.md`
- `test-codemode-advanced-text-part1.md`
- `test-codemode-advanced-text-part2.md`
- `test-codemode-advanced-transactions-part1a.md`
- `test-codemode-advanced-transactions-part1b.md`
- `test-codemode-advanced-transactions-part2.md`
- `test-codemode-advanced-types-binary.md`
- `test-codemode-advanced-types-date.md`
- `test-codemode-advanced-types-json.md`
- `test-codemode-advanced-types-numeric.md`
- `test-codemode-advanced-vector-management-part1.md`
- `test-codemode-advanced-vector-management-part2.md`
- `test-codemode-advanced-vector-search-part1.md`
- `test-codemode-advanced-vector-search-part2.md`
- `test-codemode-advanced-vector-storage.md`
- `test-codemode-advanced-versioning-part1.md`
- `test-codemode-advanced-versioning-part2.md`
- `test-codemode-sandbox.md`

## Follow Execution Protocol

When testing the contents of this directory, you MUST adhere to the following rules:

0. **Anti-Hallucination Guardrails:** Read exact filenames from `coordinator-workflow.md`. Cross-reference them with a live `list_dir`. Subagents MUST output `STATUS: SUCCESS` or `STATUS: FAILED_FILE_NOT_FOUND`. Halt immediately if a file is missing.
0.5. **Validation Strictness:** If you modify the codebase, you MUST validate changes locally by running ONLY `pnpm run lint` and `pnpm run typecheck`. Do NOT run `pnpm run test` or `pnpm run check`. Do NOT run any validation if you only modified documentation. The coordinator will run full test suites and fix broken tests at the end.
1. **Strict Code Mode Only:** All advanced stress tests must be executed entirely within the `node:worker_threads` sandbox via `mysql_execute_code`. Direct component tool calls are explicitly forbidden here unless specifically instructed for baseline comparison.
2. **Help Resources (Adaptive Architecture):** Tool and method signatures are NO LONGER automatically injected into your system prompt. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/json`) to understand the `mysql.*` API before writing code.
3. **Sequential Grouping:** Execute only **one markdown file at a time**. Report findings in `<appDataDir>\brain\<conversation-id>\task.md`. Fix errors and commit changes before advancing to the next file.
4. **Payload Optimization (Token Monitoring):**
   - These tests deliberately trigger large responses and deep architectural nesting.
   - You MUST closely monitor the `metrics.tokenEstimate` value returned from the `mysql_execute_code` payloads.
   - If extremely large unbounded responses are produced, this is flagged as a 📦 **Payload Issue**. You must halt and patch the source handler boundary constraints (e.g., restricting integer `limit` inputs or dynamically dropping table dimensions).
5. **Structured Error Adherence (P154):** When intentionally attempting boundary failure parameters (missing columns, invalid dimension types), assert that the adapter outputs a proper structured error (`{success: false, error: "..."}`) rather than leaking raw MySQL native errors.
6. **Security Sandbox Boundaries:** Ensure the server uses `ALLOWED_IO_ROOTS`. For filesystem-interacting tools, actively test directory traversal edge cases (e.g., `../../etc/passwd`). Test paths explicitly outside the allowed boundary. Confirm `SECURITY_ERROR` is correctly thrown and caught.
7. **No Persistent Pollution:** After finishing execution within a document, verify that all `stress_*` schema tables and functions generated within Code Mode have been safely `DROP`ped. No test state should bleed over into the next run.

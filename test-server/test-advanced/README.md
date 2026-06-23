# MySQL-MCP Advanced Stress Tests

> **Note**: The default test database is `testdb`. If you need to specify a database explicitly in your API calls, use `testdb`.

> **This document is optimized for AI agent consumption.** It provides context and execution rules for the advanced stress testing suite located in this directory.

This directory contains the "Second-Pass" advanced tests for the `mysql-mcp` tool groups. These tests simulate complex, edge-case, and boundary interactions using exclusively **Code Mode** (`mysql_execute_code`).

## Pre-requisites

1. Basic deterministic tool group checklists (located in `../test-codemode/*.md`) MUST be successfully passed before running these advanced tests.
2. The testing database MUST be freshly seeded or reset to the baseline schema utilizing the `node ../../scripts/reset-database.mjs` script to ensure deterministic results.

## Execution Parts

The original monolithic advanced stress testing suite was split into granular parts to preserve agent attention spans and prevent LLM context window exhaustion. Each file strictly tests one major domain or cross-domain group.

- `test-codemode-advanced-admin.md`
- `test-codemode-advanced-backup.md`
- `test-codemode-advanced-cluster-group-replication.md`
- `test-codemode-advanced-cluster-innodb.md`
- `test-codemode-advanced-concurrency.md`
- `test-codemode-advanced-core.md`
- `test-codemode-advanced-docstore.md`
- `test-codemode-advanced-events.md`
- `test-codemode-advanced-fulltext.md`
- `test-codemode-advanced-introspection.md`
- `test-codemode-advanced-json-core.md`
- `test-codemode-advanced-json-enhanced.md`
- `test-codemode-advanced-json-helpers.md`
- `test-codemode-advanced-migration.md`
- `test-codemode-advanced-monitoring.md`
- `test-codemode-advanced-optimization.md`
- `test-codemode-advanced-partitioning.md`
- `test-codemode-advanced-performance-analysis.md`
- `test-codemode-advanced-performance-anomaly.md`
- `test-codemode-advanced-proxysql-config.md`
- `test-codemode-advanced-proxysql-status.md`
- `test-codemode-advanced-replication.md`
- `test-codemode-advanced-roles.md`
- `test-codemode-advanced-router.md`
- `test-codemode-advanced-schema-management.md`
- `test-codemode-advanced-schema-routines.md`
- `test-codemode-advanced-security.md`
- `test-codemode-advanced-sessions.md`
- `test-codemode-advanced-shell-data.md`
- `test-codemode-advanced-shell-utils.md`
- `test-codemode-advanced-spatial-geometry.md`
- `test-codemode-advanced-spatial-operations.md`
- `test-codemode-advanced-spatial-queries.md`
- `test-codemode-advanced-spatial-setup.md`
- `test-codemode-advanced-stats-advanced.md`
- `test-codemode-advanced-stats-descriptive.md`
- `test-codemode-advanced-stats-window.md`
- `test-codemode-advanced-sys.md`
- `test-codemode-advanced-text.md`
- `test-codemode-advanced-transactions.md`
- `test-codemode-advanced-vector-management.md`
- `test-codemode-advanced-vector-search.md`
- `test-codemode-advanced-vector-storage.md`
- `test-codemode-advanced-versioning.md`

## Agent Execution Protocol

When testing the contents of this directory, you MUST adhere to the following rules:

1. **Strict Code Mode Only:** All advanced stress tests must be executed entirely within the `node:worker_threads` sandbox via `mysql_execute_code`. Direct component tool calls are explicitly forbidden here unless specifically instructed for baseline comparison.
2. **Help Resources (Adaptive Architecture):** Tool and method signatures are NO LONGER automatically injected into your system prompt. You MUST read the corresponding `mysql://help/{group}` resource (e.g., `mysql://help/json`) to understand the `mysql.*` API before writing code.
3. **Sequential Grouping:** Because these operations are intensive, execute only **one markdown file at a time**. Report findings in `tmp/task.md` (the project-level scratchpad), fix errors, apply updates to the changelog, and commit the changes before advancing to the next file segment.
3. **Payload Optimization (Token Monitoring):**
   - These tests deliberately trigger large responses and deep architectural nesting.
   - You MUST closely monitor the `metrics.tokenEstimate` value returned from the `mysql_execute_code` payloads.
   - If extremely large unbounded responses are produced, this is flagged as a 📦 **Payload Issue**. You must halt and patch the source handler boundary constraints (e.g., restricting integer `limit` inputs or dynamically dropping table dimensions).
4. **Structured Error Adherence (P154):** When intentionally attempting boundary failure parameters (missing columns, invalid dimension types), assert that the adapter outputs a proper structured error (`{success: false, error: "..."}`) rather than leaking raw MySQL native errors.
5. **Security Sandbox Boundaries:** Ensure the server is configured with an `ALLOWED_IO_ROOTS` environment variable. For filesystem-interacting tools (`backup`, `shell`), actively test directory traversal edge cases (e.g., `../../etc/passwd`) and paths explicitly outside the allowed boundary to confirm the `SECURITY_ERROR` is correctly thrown and gracefully caught by the handlers.
6. **No Persistent Pollution:** After finishing execution within a document, verify that all `stress_*` schema tables and functions generated within Code Mode have been safely `DROP`ped. No test state should bleed over into the next run.

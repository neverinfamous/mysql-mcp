# MySQL-MCP Advanced Stress Tests

[![Tools](https://img.shields.io/badge/Tools-200%2B-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-23-green?style=for-the-badge)](#)
[![Prompts](https://img.shields.io/badge/Prompts-64-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

## 💎 Value Proposition

- **Execute complex logic via Code Mode**, reducing token usage by 70-90%.
- **Build AI integrations instantly**.
- **Empower agents with secure database access**.
- **Scale operations with robust connection pooling**.
- **Leverage OAuth 2.1** for enterprise security.

> **This document is optimized for AI agent consumption.** It provides context and execution rules for the advanced stress testing suite located in this directory.
>
> 🚀 **Core Features Tested:** This suite focuses heavily on pushing the limits of our flagship features: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

This directory contains advanced stress tests for the tool groups.
These tests simulate complex edge cases using exclusively Code Mode.

## Meet Fast Prerequisites

1. Basic deterministic tool group checklists in `../test-codemode/*.md` MUST pass first.
2. The testing database MUST be freshly seeded or reset. Run `node ../../scripts/reset-database.mjs` to ensure deterministic results.

## Understand Execution Parts

The original monolithic advanced stress testing suite was split into granular parts. This preserves agent attention spans and prevents LLM context window exhaustion. Each file strictly tests one major domain or cross-domain group.

- `test-codemode-advanced-core-part1.md`
- `test-codemode-advanced-core-part2.md`
- `test-codemode-advanced-admin-control.md`
- `test-codemode-advanced-admin-maintenance.md`
- `test-codemode-advanced-backup-audit.md`
- `test-codemode-advanced-backup-export.md`
- `test-codemode-advanced-cluster-group-replication.md`
- `test-codemode-advanced-cluster-innodb.md`
- `test-codemode-advanced-concurrency.md`
- `test-codemode-advanced-docstore-collections.md`
- `test-codemode-advanced-docstore-documents.md`
- `test-codemode-advanced-events.md`
- `test-codemode-advanced-fulltext.md`
- `test-codemode-advanced-introspection.md`
- `test-codemode-advanced-json-core-part1.md`
- `test-codemode-advanced-json-core-part2.md`
- `test-codemode-advanced-json-enhanced.md`
- `test-codemode-advanced-json-helpers.md`
- `test-codemode-advanced-migration.md`
- `test-codemode-advanced-monitoring-health.md`
- `test-codemode-advanced-monitoring-status.md`
- `test-codemode-advanced-optimization.md`
- `test-codemode-advanced-partitioning.md`
- `test-codemode-advanced-performance-analysis-part1.md`
- `test-codemode-advanced-performance-analysis-part2.md`
- `test-codemode-advanced-performance-anomaly.md`
- `test-codemode-advanced-proxysql-config.md`
- `test-codemode-advanced-proxysql-status.md`
- `test-codemode-advanced-replication.md`
- `test-codemode-advanced-roles-assignment.md`
- `test-codemode-advanced-roles-management.md`
- `test-codemode-advanced-router-advanced.md`
- `test-codemode-advanced-router-routes.md`
- `test-codemode-advanced-schema-management.md`
- `test-codemode-advanced-schema-routines.md`
- `test-codemode-advanced-schema-triggers.md`
- `test-codemode-advanced-schema-views.md`
- `test-codemode-advanced-security-audit.md`
- `test-codemode-advanced-security-system.md`
- `test-codemode-advanced-sessions.md`
- `test-codemode-advanced-shell-data.md`
- `test-codemode-advanced-shell-utils-part1.md`
- `test-codemode-advanced-shell-utils-part2.md`
- `test-codemode-advanced-spatial-geometry.md`
- `test-codemode-advanced-spatial-operations.md`
- `test-codemode-advanced-spatial-queries.md`
- `test-codemode-advanced-spatial-setup.md`
- `test-codemode-advanced-stats-advanced.md`
- `test-codemode-advanced-stats-descriptive.md`
- `test-codemode-advanced-stats-time-series.md`
- `test-codemode-advanced-stats-window.md`
- `test-codemode-advanced-sys-part1.md`
- `test-codemode-advanced-sys-part2.md`
- `test-codemode-advanced-text.md`
- `test-codemode-advanced-transactions.md`
- `test-codemode-advanced-types-binary.md`
- `test-codemode-advanced-types-date.md`
- `test-codemode-advanced-types-json.md`
- `test-codemode-advanced-types-numeric.md`
- `test-codemode-advanced-vector-management.md`
- `test-codemode-advanced-vector-search.md`
- `test-codemode-advanced-vector-storage.md`
- `test-codemode-advanced-versioning.md`
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

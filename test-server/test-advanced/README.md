# MySQL-MCP Advanced Stress Tests

> **This document is optimized for AI agent consumption.** It provides context and execution rules for the advanced stress testing suite located in this directory.

This directory contains the "Second-Pass" advanced tests for the `mysql-mcp` tool groups. These tests simulate complex, edge-case, and boundary interactions using exclusively **Code Mode** (`mysql_execute_code`).

## Pre-requisites

1. Basic deterministic tool group checklists (located in `../test-tool-groups/*.md`) MUST be successfully passed before running these advanced tests.
2. The testing database MUST be freshly seeded or reset to the baseline schema utilizing the `../reset-database.ps1` script to ensure deterministic results.

## Execution Parts

The original monolithic advanced stress testing suite was split into 12 granular parts to preserve agent attention spans and prevent LLM context window exhaustion. Each file strictly tests one major domain or cross-domain group.

| File                                   | Primary Focus       | Key Validations                                                                                     |
| -------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| `test-tools-advanced-core.md`          | Core                | Boundary values, empty states, single-row edge cases, NULL-heavy data, state pollution, idempotency |
| `test-tools-advanced-transactions.md`  | Transactions        | Aborted transaction recovery, savepoint stress, mixed statement execution, failure rollback         |
| `test-tools-advanced-json.md`          | JSON                | Deep mutation workflows, nested path operations, merge operations                                   |
| `test-tools-advanced-spatial.md`       | Spatial             | Boundary coordinates, out-of-bounds validation, exact boundary values                               |
| `test-tools-advanced-document.md`      | Document Store      | Empty array edge cases, nonexistent field criteria, collection lifecycle                            |
| `test-tools-advanced-fulltext.md`      | Fulltext/Search     | Search pipeline lifecycle, temp table FTS index creation and search                                 |
| `test-tools-advanced-introspection.md` | Introspection       | Deep dependency graphs, circular foreign keys, cascade limit testing                                |
| `test-tools-advanced-migration.md`     | Migration           | Corrupted checksums, out-of-order logs, idempotency, boundary rollbacks                             |
| `test-tools-advanced-stats.md`         | Stats               | Null handling, zero-variance arrays, hypothesis boundaries, missing types                           |
| `test-tools-advanced-admin.md`         | Admin/Error Quality | Cross-group error message quality, type mismatches, invalid parameter values, payload sizes         |
| `test-tools-advanced-performance.md`   | Performance/Payload | Truncation indicators, summary mode, anomaly detection bounds                                       |
| `test-tools-advanced-cross-group.md`   | Cross-Group         | Code Mode parity, discovery methods, multi-group integration workflows                              |

## Agent Execution Protocol

When testing the contents of this directory, you MUST adhere to the following rules:

1. **Strict Code Mode Only:** All advanced stress tests must be executed entirely within the `node:worker_threads` sandbox via `mysql_execute_code`. Direct component tool calls are explicitly forbidden here unless specifically instructed for baseline comparison.
2. **Sequential Grouping:** Because these operations are intensive, execute only **one markdown file at a time**. Report findings, fix errors, apply updates to the changelog, and commit the changes before advancing to the next file segment.
3. **Payload Optimization (Token Monitoring):**
   - These tests deliberately trigger large responses and deep architectural nesting.
   - You MUST closely monitor the `metrics.tokenEstimate` value returned from the `mysql_execute_code` payloads.
   - If extremely large unbounded responses are produced, this is flagged as a 📦 **Payload Issue**. You must halt and patch the source handler boundary constraints (e.g., restricting integer `limit` inputs or dynamically dropping table dimensions).
4. **Structured Error Adherence (P154):** When intentionally attempting boundary failure parameters (missing columns, invalid dimension types), assert that the adapter outputs a proper structured error (`{success: false, error: "..."}`) rather than leaking raw MySQL native errors.
5. **No Persistent Pollution:** After finishing execution within a document, verify that all `stress_*` schema tables and functions generated within Code Mode have been safely `DROP`ped. No test state should bleed over into the next run.

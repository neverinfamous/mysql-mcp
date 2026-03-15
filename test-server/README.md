# mysql-mcp Test Server — Agent Testing Instructions

> **This README is optimized for AI agent consumption.** It serves as the primary orchestration document for running manual MCP functionality tests against the local MySQL database (`testdb`).

## Files

| File | Size | Purpose | When to Read |
|------|------|---------|--------------|
| `test-tools.md` | ~17KB | **Entry-point protocol** — connection details, testing rules, structured error patterns, Zod/P154/Split Schema verification, reporting format | Always read first |
| `test-preflight.md` | ~2KB | **Pre-flight check** — validates slim instructions, help resources, data resources, and tool-filter alignment in 5 steps | Before any test pass |
| `test-agent-experience.md` | ~8KB | **Unguided agent test** — 35 open-ended scenarios across 8 passes validating help resource sufficiency | When testing agent experience |
| `test-group-tools-core.md` | ~10KB | **Deterministic checklists** — core, transactions, schema groups | When testing core/transactions/schema |
| `test-group-tools-data.md` | ~13KB | **Deterministic checklists** — json, fulltext, document, text, stats groups | When testing data groups |
| `test-group-tools-admin.md` | ~12KB | **Deterministic checklists** — admin, monitoring, perf, optimization, security, roles, backup, replication, sys groups | When testing admin/infra groups |
| `test-group-tools-ext.md` | ~6KB | **Deterministic checklists** — spatial, partitioning, events groups | When testing extension groups |
| `test-group-tools-ecosystem.md` | ~8KB | **Deterministic checklists** — cluster, proxysql, router, shell groups | When testing ecosystem groups |
| `advanced-test-tools.md` | ~13KB | **Stress tests** — boundary values, state pollution, error quality, concurrency, extension edges, payload truncation, code mode parity, cross-group integration | After group checklists pass |
| `Tool-Reference.md` | ~22KB | Complete 192-tool reference mapped to 25 groups | Reference |
| [`code-map.md`](code-map.md) | ~14KB | **Source Code Map** — Directory tree, handler→tool mapping, type/schema locations, error hierarchy, constants, architecture patterns. | When debugging source code or making changes |
| `test-resources.md` | ~4KB | Resource testing plan (18 `mysql://` resources) | When testing resources |
| `test-resources.sql` | ~8KB | Seed SQL for resource testing | Reference |
| `test-prompts.md` | ~7KB | Prompt testing plan | When testing prompts |
| `test-prompts.sql` | ~15KB | Seed SQL for prompt testing | Reference |
| `reset-database.ps1` | ~6KB | Reset + re-seed `testdb` | When data is dirty |
| `test-seed.sql` | ~27KB | Primary seed SQL (DDL + DML) for all `test_*` tables | Reference only |
| `sample.csv`, `sample.json` | <1KB | Fixtures for import/export testing | Used by text/CSV tools |
| `test-instruction-levels.mjs` | ~4KB | Integration test — slim instructions + help resource filtering by group | Run after build |

## Test Database Schema (Quick Reference)

| Table | Rows | Key Columns | JSON Columns |
|-------|------|-------------|--------------|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_json_docs` | 8 | id, doc, metadata, tags | doc, metadata, tags |
| `test_articles` | 10 | id, title, body, author (FULLTEXT) | — |
| `test_users` | 10 | id, username, email, phone, bio, role | — |
| `test_measurements` | 200 | id, sensor_id (1-5), temperature, humidity | — |
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT) | — |
| `test_categories` | 17 | id, name, path, level | — |
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, _id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |

## Conventions & Protocols

| Convention | Rule |
|---|---|
| Temp table prefix | `temp_*` (e.g., `temp_analysis_results`) |
| Stress test prefix | `stress_*` (for advanced tests only) |
| Test view prefix | `test_view_*` |
| Test procedure prefix | `test_proc_*` |
| Error response format | `{success: false, error: "...", code, category, suggestion, recoverable}` — NEVER raw MCP exceptions |
| Reporting | ❌ Fail / ⚠️ Issue / 📦 Payload / ✅ Pass (inline only) |
| Cleanup | Drop all `temp_*` / `stress_*` objects after testing |

## Connection Details

| Property  | Value         |
| --------- | ------------- |
| Host      | `localhost`   |
| Port      | `3306`        |
| Database  | `testdb`      |
| Container | `mysql-final` |

> Note: Use `docker ps` / `docker start mysql-final` if connection is refused. Ecosystem tools connect on alternate ports (cluster: 3307, router: 8443, proxysql: 6032). See `test-tools.md` for details.

## Agent Workflow for Tests

1. Read `mysql://help` resource (via MCP — critical gotchas, aliases, Code Mode API) and relevant group help (`mysql://help/{group}`).
2. Read `test-tools.md` for the entry-point protocol: Split Schema, Zod validation, P154, and structured error patterns.
3. Read the relevant `test-group-tools-*.md` for your target group's deterministic checklist.
4. Execute the checklist items first (minimum bar), then freeform exploration.
5. Clean up all `temp_*` tables using `DROP TABLE IF EXISTS`.
6. Report findings using ❌/⚠️/📦 format. Error paths MUST return enriched `ErrorResponse` (`{success: false, error, code, category, recoverable}`). Raw MCP errors = ❌.

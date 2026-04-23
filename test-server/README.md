# mysql-mcp Test Server — Agent Testing Instructions

> **This README is optimized for AI agent consumption.** It serves as the primary orchestration document for running manual MCP functionality tests against the local MySQL database (`testdb`).

## Files

| File / Directory | Purpose | When to Read |
|------------------|---------|--------------|
| `test-tools.md` | **Entry-point protocol** — connection details, testing rules, structured error patterns, Zod/P154/Split Schema verification, reporting format | Always read first |
| `test-preflight.md` | **Pre-flight check** — validates slim instructions, help resources, data resources, and tool-filter alignment in 5 steps | Before any test pass |
| `test-tool-groups/` | **Standard tests** — 25 self-contained per-group prompts for direct MCP tool call validation | When testing individual tool groups |
| `test-tool-groups-codemode/` | **Code Mode tests** — 26 per-group prompts for `mysql_execute_code` validation (including cross-group) | When testing Code Mode parity |
| `test-advanced/` | **Advanced stress tests** — 9 files for boundary values, state pollution, payload monitoring, cross-group integration (Code Mode only) | After group checklists pass |
| `Tool-Reference.md` | Complete 192-tool reference mapped to 25 groups | Reference |
| [`code-map.md`](code-map.md) | **Source Code Map** — Directory tree, handler→tool mapping, type/schema locations, error hierarchy, constants, architecture patterns | When debugging source code or making changes |
| `test-resources.md` | Resource testing plan (18 `mysql://` resources) | When testing resources |
| `test-resources.sql` | Seed SQL for resource testing | Reference |
| `test-prompts-notes.md` | Prompt testing plan | When testing prompts |
| `test-prompts.sql` | Seed SQL for prompt testing | Reference |
| `reset-database.ps1` | Reset + re-seed `testdb` | When data is dirty |
| `test-seed.sql` | Primary seed SQL (DDL + DML) for all `test_*` tables | Reference only |
| `sample.csv`, `sample.json` | Fixtures for import/export testing | Used by text/CSV tools |
| `test-instruction-levels.mjs` | Integration test — slim instructions + help resource filtering by group | Run after build |

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
3. **Standard tests**: Read the relevant `test-tool-groups/test-tool-group-{name}.md` for direct MCP tool call validation.
4. **Code Mode tests**: Read the relevant `test-tool-groups-codemode/test-tool-group-codemode-{name}.md` for `mysql_execute_code` validation.
5. **Advanced tests**: After group checklists pass, read `test-advanced/test-tools-advanced-{name}.md` for stress testing.
6. Execute the checklist items first (minimum bar), then freeform exploration.
7. Clean up all `temp_*` / `stress_*` tables using `DROP TABLE IF EXISTS`.
8. Report findings using ❌/⚠️/📦 format. Error paths MUST return enriched `ErrorResponse` (`{success: false, error, code, category, recoverable}`). Raw MCP errors = ❌.


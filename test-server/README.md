# mysql-mcp Test Server — Agent Testing Instructions

[![npm version](https://img.shields.io/npm/v/mysql-mcp.svg)](https://npmjs.org/package/mysql-mcp) [![License](https://img.shields.io/npm/l/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)  
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## Value Proposition
- Build AI integrations instantly.
- Empower agents with secure database access.
- Execute complex logic via Code Mode.
- Scale operations with robust connection pooling.
- Leverage OAuth 2.1 for enterprise security.

> **This README is optimized for AI agent consumption.** It serves as the primary orchestration document for running manual MCP functionality tests against the local MySQL database (`testdb`).
>
> 🚀 **Core Features:** Our test suite rigorously validates the server's flagship features: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

## Navigate Core Files

| File / Directory             | Purpose                                                                                                                                       | When to Read                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `test-tools.md`              | **Entry-point protocol** — connection details, testing rules, structured error patterns, Zod/P154/Split Schema verification, reporting format | Always read first                            |
| `test-preflight.md`          | **Pre-flight check** — validates slim instructions, help resources, data resources, and tool-filter alignment in 5 steps                      | Before any test pass                         |
| `test-tool-groups/`          | **Standard tests** — 57 self-contained modular prompts for direct MCP tool call validation                                                    | When testing individual tool groups          |
| `test-codemode/`             | **Code Mode tests** — 53 self-contained modular prompts for `mysql_execute_code` validation                                                   | When testing Code Mode parity                |
| `test-usability/`            | **Usability tests** — 89 prompts for hallucination fuzzing and UX validation via Code Mode                                                                     | When testing UX                              |
| `test-advanced/`             | **Advanced stress tests** — 64 files for boundary values, state pollution, and payload monitoring (Code Mode only)                            | After group checklists pass                  |
| `tool-reference.md`          | Complete 241-tool reference mapped to groups                                                                                               | Reference                                    |
| [`code-map.md`](code-map.md) | **Source Code Map** — Directory tree, handler→tool mapping, type/schema locations, error hierarchy, constants, architecture patterns          | When debugging source code or making changes |
| `test-resources.md`          | Resource testing plan (23 total resources)                                                                                               | When testing resources                       |
| `test-resources.sql`         | Seed SQL for resource testing                                                                                                                 | Reference                                    |
| `test-prompts-notes.md`      | Prompt testing plan                                                                                                                           | When testing prompts                         |
| `test-prompts.sql`           | Seed SQL for prompt testing                                                                                                                   | Reference                                    |
| `../scripts/reset-database.mjs`| Reset + re-seed `testdb`                                                                                          | When data is dirty                           |
| `test-seed.sql`              | Primary seed SQL (DDL + DML) for all `test_*` tables                                                                                          | Reference only                               |
| `sample.csv`, `sample.json`  | Fixtures for import/export testing                                                                                                            | Used by text/CSV tools                       |
| `../scripts/test-*`            | Automated test scripts                                                                                                                        | Run after build                              |

## Reference Test Database Schema

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (1-5), temperature, humidity        | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_categories`   | 17   | id, name, path, level                             | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |

## Follow Conventions and Protocols

| Convention            | Rule                                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Temp table prefix     | `temp_*` (e.g., `temp_analysis_results`)                                                             |
| Stress test prefix    | `stress_*` (for advanced tests only)                                                                 |
| Test view prefix      | `test_view_*`                                                                                        |
| Test procedure prefix | `test_proc_*`                                                                                        |
| Error response format | `{success: false, error: "...", code, category, suggestion, recoverable}` — NEVER raw MCP exceptions |
| Reporting             | ❌ Fail / ⚠️ Issue / 📦 Payload / ✅ Pass (inline only)                                              |
| Cleanup               | Drop all `temp_*` / `stress_*` objects after testing                                                 |

## Configure Connection Details

| Property  | Value         |
| --------- | ------------- |
| Host      | `localhost`   |
| Port      | `3306`        |
| Database  | `testdb`      |
| Container | `mysql-final` |

> Note: Use `docker ps` / `docker start mysql-final` if connection is refused. Ecosystem tools connect on alternate ports (cluster: 3307, router: 8443, proxysql: 6032). See `test-tools.md` for details.

## Execute Agent Test Workflow

1. Read `mysql://help` resource and relevant group help. This covers gotchas, aliases, and APIs.
2. Read `test-tools.md` for entry-point protocol details. This includes Split Schema, Zod validation, and structured errors.
3. **Standard tests**: Read the relevant `test-tool-groups/` file. This validates direct MCP tool calls.
4. **Code Mode tests**: Read the relevant `test-codemode/` file. This validates the `mysql_execute_code` tool.
5. **Advanced tests**: Read `test-advanced/` files for stress testing. Only do this after group checklists pass.
6. Execute the checklist items first (minimum bar), then freeform exploration.
7. Clean up all `temp_*` / `stress_*` tables using `DROP TABLE IF EXISTS`.
8. Report findings using ❌/⚠️/📦 format. Error paths MUST return enriched `ErrorResponse`. Raw MCP errors = ❌.

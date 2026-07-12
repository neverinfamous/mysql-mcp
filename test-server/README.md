# MySQL MCP Test Server — Agent Testing Instructions

[![npm version](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://npmjs.org/package/@neverinfamous/mysql-mcp) [![License](https://img.shields.io/npm/l/@neverinfamous/mysql-mcp.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)  
[![Model Context Protocol](https://img.shields.io/badge/MCP-Protocol-purple.svg)](https://modelcontextprotocol.io/) [![Docker Support](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)


> **This README is optimized for AI agent consumption.** It serves as the primary orchestration document for running manual MCP functionality tests against the local MySQL database (`testdb`).
>
> 🚀 **Core Features:** Our test suite rigorously validates the server's flagship features: **OAuth 2.1**, **Code Mode**, and **Connection Pooling**.

## Navigate Core Files

| File / Directory             | Purpose                                                                                                                                       | When to Read                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `test-preflight.md`          | **Pre-flight check** — validates slim instructions, help resources, data resources, and tool-filter alignment in 5 steps                      | Before any test pass                         |
| `test-codemode/`             | **Code Mode tests** — Modular testing prompts for testing tool parity exclusively via `mysql_execute_code`                                          | When testing Code Mode parity                |
| `test-usability/`            | **Usability testing** — Organic prompts to fuzz tool boundaries and hallucinate schema properties inside Code Mode.                           | When hardening Code Mode against fuzzing     |
| `test-usability-direct/`     | **Direct Usability testing** — Organic fuzzing of the direct tool invocation payload schemas (bypassing Code Mode).                           | When hardening standard tool input schemas   |
| `test-advanced/`             | **Advanced stress tests** — Complex, chained prompts covering boundaries like isolated-vm escapes and concurrency.                            | When validating infrastructure stability     |
| `test-tool-groups/`          | **Standard Tool groups** — Simple, atomic tests that manually call MCP functions directly.                                                    | When verifying standard capabilities         |
| `tool-reference.md`          | Complete 242 tool reference mapped to groups                                                                                               | Reference                                    |
| [`code-map.md`](code-map.md) | **Source Code Map** — Directory tree, handler→tool mapping, type/schema locations, error hierarchy, constants, architecture patterns          | When debugging source code or making changes |
| `test-resources.md`          | Resource testing plan (Multiple total resources)                                                                                               | When testing resources                       |
| `test-resources.sql`         | Seed SQL for resource testing                                                                                                                 | Reference                                    |
| `test-prompts-notes.md`      | Prompt testing plan                                                                                                                           | When testing prompts                         |
| `test-prompts.sql`           | Seed SQL for prompt testing                                                                                                                   | Reference                                    |
| `infrastructure/scripts/reset-database.mjs` | Reset + re-seed `testdb`                                                                                          | When data is dirty                           |
| `test-seed.sql`              | Primary seed SQL (DDL + DML) for all `test_*` tables                                                                                          | Reference only                               |
| `sample.csv`, `sample.json`  | Fixtures for import/export testing                                                                                                            | Used by text/CSV tools                       |
| `infrastructure/scripts/recreate-test-ecosystem.mjs` | Completely tear down and recreate the local test cluster                                                    | If the cluster fails                         |

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
| Container | `mysql-node1` |

> Note: Use `docker ps` / `docker start mysql-node1` if connection is refused. Ecosystem tools connect on alternate ports (cluster: 3307, router: 6446, proxysql: 6032).

## Infrastructure Management (Docker)

If the test infrastructure breaks or needs to be completely wiped and re-created (e.g., due to port conflicts, corruption, or schema changes), use the automated ecosystem scripts provided in the `infrastructure/scripts` directory:

1. **Recreate the ecosystem:**
   ```powershell
   node infrastructure/scripts/recreate-test-ecosystem.mjs
   ```
   This will completely tear down the containers, spin them back up, wait for them to become healthy, initialize the InnoDB cluster, join the secondary nodes, and automatically run the `reset-database.mjs` seed script.

2. **Re-seed without teardown:**
   If you just need to reset the data because you dirtied it during testing:
   ```powershell
   node infrastructure/scripts/reset-database.mjs
   ```

## Execute Agent Test Workflow

1. Read `mysql://help` resource and relevant group help. This covers gotchas, aliases, and APIs.
2. Read the appropriate `coordinator-workflow.md` file in `test-codemode/`, `test-tool-groups/`, `test-usability/`, `test-usability-direct/`, or `test-advanced/` to orchestrate your tests.
3. **Code Mode tests**: Read the relevant `test-codemode/` file. This validates the `mysql_execute_code` tool.
4. Execute the checklist items first (minimum bar), then freeform exploration.
5. Clean up all `temp_*` / `stress_*` tables using `DROP TABLE IF EXISTS`.
6. Report findings using ❌/⚠️/📦 format. Error paths MUST return enriched `ErrorResponse`. Raw MCP errors = ❌.

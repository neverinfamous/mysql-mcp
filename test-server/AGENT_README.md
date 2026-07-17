# MySQL MCP Test Server — Agent Testing Instructions

> **This README is optimized for AI agent consumption.** It serves as the primary orchestration document for running manual MCP functionality tests against the local MySQL database (`testdb`).
> 
> **CRITICAL RULE:** `scripts/test-manifest.ts` is the single source of truth generating all markdown tests via `scripts/content/*.content.md` partials. Manual editing of the generated markdown files in `test-usability/`, `test-usability-direct/`, `test-advanced/`, and `test-tool-groups/` is **STRICTLY FORBIDDEN** as they will be overwritten by the generator.

## Navigate Core Files

| File / Directory             | Purpose                                                                                                                                       | When to Read                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `test-preflight.md`          | **Pre-flight check** — validates slim instructions, help resources, data resources, and tool-filter alignment in 5 steps                      | Before any test pass                         |
| `test-usability/`            | **Usability testing** — Organic prompts to fuzz tool boundaries and hallucinate schema properties inside Code Mode.                           | When hardening Code Mode against fuzzing     |
| `test-usability-direct/`     | **Direct Usability testing** — Organic fuzzing of the direct tool invocation payload schemas (bypassing Code Mode).                           | When hardening standard tool input schemas   |
| `test-advanced/`             | **Advanced stress tests** — Complex, chained prompts covering boundaries like isolated-vm escapes and concurrency.                            | When validating infrastructure stability     |
| `test-tool-groups/`          | **Standard Tool groups** — Simple, atomic tests that manually call MCP functions directly.                                                    | When verifying standard capabilities         |
| `scripts/generate-tests.ts`  | **Test Generation Engine** — Auto-generates the entire test suite from `test-manifest.ts` and template partials. See `scripts/AGENT_README.md`. | When modifying test structure or adding tools|
| `scripts/verify-ssot.ts`     | **SSoT Verification Script** — Mathematically verifies parity between `tool-constants.ts` and `test-manifest.ts`, generating an output mapping | When verifying coverage or running the dynamic-audit workflow |
| `tool-reference.md`          | Complete tool reference mapped to groups                                                                                                   | Reference                                    |
| [`code-map.md`](code-map.md) | **Source Code Map** — Directory tree, handler→tool mapping, type/schema locations, error hierarchy, constants, architecture patterns          | When debugging source code or making changes |
| `infrastructure/scripts/reset-database.mjs` | Reset + re-seed `testdb`                                                                                          | When data is dirty                           |
| `test-seed.sql`              | Primary seed SQL (DDL + DML) for all `test_*` tables                                                                                          | Reference only                               |
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

The project provides two local testing environments. Use the appropriate connection details depending on which docker-compose setup is running.

**Standalone (Root `docker-compose.yml`)**
| Property  | Value         |
| --------- | ------------- |
| Host      | `localhost`   |
| Port      | `3306`        |
| Database  | `testdb`      |
| Container | `mysql`       |

**Cluster Ecosystem (`test-server/infrastructure/docker-compose.yml`)**
| Property  | Value         |
| --------- | ------------- |
| Host      | `localhost`   |
| Port      | `3307`        |
| Database  | `testdb`      |
| Container | `mysql-node1` |

> Note: Use `docker ps` if connection is refused. The ecosystem also provides the MySQL Router on `6446` and ProxySQL on `6032`.

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
2. Read the appropriate `coordinator-workflow.md` file in `test-tool-groups/`, `test-usability/`, `test-usability-direct/`, or `test-advanced/` to orchestrate your tests.
3. Execute the checklist items first (minimum bar), then freeform exploration.
5. Clean up all `temp_*` / `stress_*` tables using `DROP TABLE IF EXISTS`.
6. Report findings using ❌/⚠️/📦 format. Error paths MUST return enriched `ErrorResponse`. Raw MCP errors = ❌.

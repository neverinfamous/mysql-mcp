# mysql-mcp Advanced Stress Tests: [proxysql]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table               | Rows | Key Columns                                       | JSON Columns        |
| ------------------- | ---- | ------------------------------------------------- | ------------------- |
| `test_products`     | 16   | id, name, price, category                         | metadata            |
| `test_orders`       | 20   | id, product_id (FK), customer_name, status (ENUM) | notes               |
| `test_json_docs`    | 8    | id, doc, metadata, tags                           | doc, metadata, tags |
| `test_articles`     | 10   | id, title, body, author (FULLTEXT)                | —                   |
| `test_users`        | 10   | id, username, email, phone, bio, role             | —                   |
| `test_measurements` | 200  | id, sensor_id (INT 1-5), temperature, humidity    | —                   |
| `test_locations`    | 15   | id, name, city, latitude, longitude, geom (POINT) | —                   |
| `test_events`       | 100  | id, event_type (ENUM), user_id (1-8), event_date  | payload             |
| `test_documents`    | 10   | id, collection_name, doc, \_id (UUID)             | doc                 |
| `test_partitioned`  | 26   | id, region, created_at                            | data                |
| `test_categories`   | 17   | id, name, path, level                             | —                   |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type                 | What you see                                     | Verdict            |
| -------------------- | ------------------------------------------------ | ------------------ |
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct            |
| **MCP error** ❌     | Raw error string, no `success` field             | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

## Infrastructure Prerequisite

> **Note:** Requires running ProxySQL admin interface. Configure `mysql-ecosystem` MCP server with `--proxysql-*` parameters. If ProxySQL is unavailable, Category 1 validates graceful degradation. If available, Categories 2–3 validate happy-path and payload efficiency.

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-proxysql.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Graceful Degradation (No-ProxySQL Environment)

1. `proxysql_status()` → verify structured `{success: false}` (not raw connection error)
2. `proxysql_servers()` → verify structured response
3. `proxysql_query_rules()` → verify structured response
4. `proxysql_query_digest()` → verify structured response
5. `proxysql_connection_pool()` → verify structured response
6. `proxysql_users()` → verify structured response
7. `proxysql_global_variables()` → verify structured response
8. `proxysql_runtime_status()` → verify structured response
9. `proxysql_memory_stats()` → verify structured response
10. `proxysql_commands()` → verify structured response
11. `proxysql_process_list()` → verify structured response
12. All 11 errors must use consistent `{success: false, error: "..."}` format

## Category 2: Happy-Path Stress (When ProxySQL IS Available)

13. `proxysql_status()` → verify version and uptime fields
14. `proxysql_servers()` → verify backend server listing with hostgroup info
15. `proxysql_connection_pool()` → verify pool statistics structure
16. `proxysql_query_digest({limit: 5})` → verify top query digests with timing info
17. `proxysql_runtime_status()` → verify runtime config snapshot

## Category 3: Payload Monitoring & Filter Boundaries

18. `proxysql_global_variables()` with no limit → log token estimate, flag > 500 tokens as 📦
19. `proxysql_global_variables({limit: 5})` → log token estimate, verify significant reduction
20. `proxysql_query_digest()` with no limit → log token estimate
21. `proxysql_query_digest({limit: 1})` → log token estimate
22. `proxysql_process_list()` → log token estimate
23. `proxysql_status({summary: true})` → log token estimate, verify reduction vs. full

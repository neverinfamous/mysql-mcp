# mysql-mcp Advanced Stress Tests: [cluster]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

## Test Database Schema

| Table | Rows | Key Columns | JSON Columns |
|---|---|---|---|
| `test_products` | 16 | id, name, price, category | metadata |
| `test_orders` | 20 | id, product_id (FK), customer_name, status (ENUM) | notes |
| `test_json_docs` | 8 | id, doc, metadata, tags | doc, metadata, tags |
| `test_articles` | 10 | id, title, body, author (FULLTEXT) | — |
| `test_users` | 10 | id, username, email, phone, bio, role | — |
| `test_measurements` | 200 | id, sensor_id (INT 1-5), temperature, humidity | — |
| `test_locations` | 15 | id, name, city, latitude, longitude, geom (POINT) | — |
| `test_events` | 100 | id, event_type (ENUM), user_id (1-8), event_date | payload |
| `test_documents` | 10 | id, collection_name, doc, \_id (UUID) | doc |
| `test_partitioned` | 26 | id, region, created_at | data |
| `test_categories` | 17 | id, name, path, level | — |

## Structured Error Response Pattern

All tools must return errors as structured objects:

```json
{ "success": false, "error": "Human-readable error message" }
```

### Handler Error vs MCP Error

| Type | What you see | Verdict |
|---|---|---|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw error string, no `success` field | Bug — report as ❌ |

During error path testing, if an invalid Code Mode call returns a raw error string instead of a JSON object with `success` and `error` fields, report it as ❌.

## Infrastructure Prerequisite

> **Note:** Requires InnoDB Cluster / Group Replication. Configure `mysql-ecosystem` MCP server. If infrastructure is unavailable, Category 1 validates graceful degradation. If available, Category 2–3 validate happy-path stress and payload efficiency.

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-cluster.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Graceful Degradation (No-Cluster Environment)

1. `mysql_gr_status()` → verify structured `{success: false}` (not raw exception) when GR is not configured
2. `mysql_gr_members()` → verify structured response
3. `mysql_gr_primary()` → verify structured response
4. `mysql_gr_transactions()` → verify structured response
5. `mysql_gr_flow_control()` → verify structured response
6. `mysql_cluster_status()` → verify structured `{success: false}` when no InnoDB Cluster
7. `mysql_cluster_instances()` → verify structured response
8. `mysql_cluster_topology()` → verify structured response
9. `mysql_cluster_router_status()` → verify structured response
10. `mysql_cluster_switchover()` → verify structured `{success: false}` (dangerous operation with no cluster)
11. All 10 errors must use consistent `{success: false, error: "..."}` format — no raw MCP exceptions or property leakages

## Category 2: Happy-Path Stress (When Cluster IS Available)

12. `mysql_gr_status()` → verify members, state, and group name are present
13. `mysql_gr_members()` → verify at least 1 member with host/port/role
14. `mysql_cluster_status()` → verify topology and status fields
15. `mysql_cluster_instances()` → verify instance details match member count
16. `mysql_cluster_topology()` → verify graph-like structure with roles

## Category 3: Summary Mode & Payload Monitoring

17. `mysql_cluster_status()` full → log token estimate
18. `mysql_cluster_status({summary: true})` → log token estimate, verify ≥ 30% reduction
19. `mysql_cluster_router_status()` full → log token estimate
20. `mysql_cluster_router_status({summary: true})` → log token estimate
21. Flag any response > 500 tokens as 📦

# mysql-mcp Advanced Stress Tests: [cluster]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

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

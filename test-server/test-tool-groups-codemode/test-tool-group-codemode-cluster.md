# mysql-mcp Code Mode Re-Testing: [cluster]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Infrastructure Prerequisite

> **Note:** Requires InnoDB Cluster / Group Replication. Configure `mysql-ecosystem` MCP server. In single-server environments, verify structured error responses.

## Requirements

1. 
2. 

---

## Group Focus: cluster

cluster Tool Group (10 tools +1 code mode):

1. `mysql_gr_status` 2. `mysql_gr_members` 3. `mysql_gr_primary`
4. `mysql_gr_transactions` 5. `mysql_gr_flow_control` 6. `mysql_cluster_status`
7. `mysql_cluster_instances` 8. `mysql_cluster_topology` 9. `mysql_cluster_router_status`
10. `mysql_cluster_switchover`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.cluster.help()` → verify method listing
2. `mysql.cluster.grStatus()` → GR status or structured error
3. `mysql.cluster.grMembers()` → members or empty
4. `mysql.cluster.status()` → cluster status or structured error
5. `mysql.cluster.status({summary: true})` → summarized output
6. `mysql.cluster.instances()` → instance details
7. `mysql.cluster.topology()` → topology map
8. `mysql.cluster.routerStatus()` → router status
9. `mysql.cluster.routerStatus({summary: true})` → summarized

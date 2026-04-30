# mysql-mcp Code Mode Re-Testing: [cluster]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

## Infrastructure Prerequisite

> **Note:** Requires InnoDB Cluster / Group Replication. Configure `mysql-ecosystem` MCP server. In single-server environments, verify structured error responses.

---

## Group Focus: cluster

cluster Tool Group (10 tools +1 code mode):

1. `mysql_gr_status` 2. `mysql_gr_members` 3. `mysql_gr_primary`
2. `mysql_gr_transactions` 5. `mysql_gr_flow_control` 6. `mysql_cluster_status`
3. `mysql_cluster_instances` 8. `mysql_cluster_topology` 9. `mysql_cluster_router_status`
4. `mysql_cluster_switchover`

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

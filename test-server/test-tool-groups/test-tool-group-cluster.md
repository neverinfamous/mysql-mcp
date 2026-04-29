# mysql-mcp Tool Group Testing: [cluster]

**ESSENTIAL INSTRUCTIONS**

- Execute **EVERY** numbered test below using direct MCP tool calls, **NOT** codemode.
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.

## Reporting Format

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized.

> **Token estimates**: Every tool response includes `_meta.tokenEstimate` in its `content[].text` payload.

## Infrastructure Prerequisite

> **Note:** The cluster tools require InnoDB Cluster / Group Replication to be running. Configure the `mysql-ecosystem` MCP server entry and ensure the cluster containers are active before running these tests. In a single-server environment, these tools should return structured errors or empty-state responses — NOT raw MCP exceptions.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: cluster

### cluster Group-Specific Testing

cluster Tool Group (10 tools +1 for code mode):

1. 'mysql_gr_status'
2. 'mysql_gr_members'
3. 'mysql_gr_primary'
4. 'mysql_gr_transactions'
5. 'mysql_gr_flow_control'
6. 'mysql_cluster_status'
7. 'mysql_cluster_instances'
8. 'mysql_cluster_topology'
9. 'mysql_cluster_router_status'
10. 'mysql_cluster_switchover'
11. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY. In a non-cluster environment, verify the tools return structured error or empty-state responses.

1. ✅ `mysql_gr_status()` → verified GR status returns correctly.
2. ✅ `mysql_gr_members()` → verified members list returns successfully.
3. ✅ `mysql_cluster_status()` → verified full cluster status returns.
4. ✅ `mysql_cluster_status({summary: true})` → verified summarized output.
5. ✅ `mysql_cluster_instances()` → verified instance details return.
6. ✅ `mysql_cluster_topology()` → verified topology map returns correctly.
7. ✅ `mysql_cluster_router_status()` → verified router status returns correctly.
8. ✅ `mysql_cluster_router_status({summary: true})` → verified summarized router status.
9. ✅ `mysql_cluster_switchover()` → verified readiness check without performing switchover.

**Zod validation error paths (🔴):**

10. ✅ 🔴 `mysql_gr_primary({})` → behavior verified, successfully accepted empty params for read-only mode.

# mysql-mcp Tool Group Testing: [router]

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

> **Note:** The Router tools require MySQL Router 8.0.17+ with REST API enabled. Configure the `mysql-ecosystem` MCP server entry with `--router-*` parameters and ensure Router is active. In a non-Router environment, these tools should return structured errors — NOT raw MCP exceptions.

## Structured Error Response Pattern

| Type | What you see | Verdict |
|------|-------------|---------|
| **Handler error** ✅ | Parseable JSON with `success` and `error` fields | Correct |
| **MCP error** ❌ | Raw text error string with `isError: true` | Bug |

## P154 / Cleanup / Post-Test

- After testing: fix findings, read `code-map.md` before changes, update changelog, commit without pushing.

---

## Group Focus: router

### router Group-Specific Testing

router Tool Group (9 tools +1 for code mode):

1. 'mysql_router_status'
2. 'mysql_router_routes'
3. 'mysql_router_route_status'
4. 'mysql_router_route_health'
5. 'mysql_router_route_connections'
6. 'mysql_router_route_destinations'
7. 'mysql_router_route_blocked_hosts'
8. 'mysql_router_metadata_status'
9. 'mysql_router_pool_status'
10. 'mysql_execute_code' (codemode, auto-added)

> **Instructions**: Execute every numbered checklist item with the exact inputs shown using DIRECT TOOL CALLS ONLY.

1. `mysql_router_status()` → verify Router version and process status
2. `mysql_router_routes()` → verify configured routes listing
3. `mysql_router_route_status({routeName: "bootstrap_rw"})` → verify route status (or structured error if route doesn't exist)
4. `mysql_router_route_health({routeName: "bootstrap_rw"})` → verify health check
5. `mysql_router_route_connections({routeName: "bootstrap_rw"})` → verify active connections
6. `mysql_router_route_destinations({routeName: "bootstrap_rw"})` → verify backend destinations
7. `mysql_router_route_blocked_hosts({routeName: "bootstrap_rw"})` → verify blocked hosts (may be empty)
8. `mysql_router_metadata_status({metadataName: "bootstrap"})` → verify metadata cache status (requires InnoDB Cluster)
9. `mysql_router_pool_status({poolName: "default"})` → verify pool statistics

**Domain error paths (🔴):**

10. 🔴 `mysql_router_route_status({routeName: "nonexistent_route_xyz"})` → `{success: false, error: "..."}` handler error

**Zod validation error paths (🔴):**

11. 🔴 `mysql_router_route_status({})` → `{success: false, error: "..."}` (missing required `routeName`)

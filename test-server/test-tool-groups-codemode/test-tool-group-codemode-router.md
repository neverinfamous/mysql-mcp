# mysql-mcp Code Mode Re-Testing: [router]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test of the tool group listed below using ONLY code mode (`mysql_execute_code`).
- Do not use scripts or terminal to replace planned tests.
- Do not modify or skip tests.
- Ensure your validation script returns an aggregated array of failures if any exist.
- Group multiple tests into a single script to save context window tokens.
- All changes MUST be consistent with other mysql-mcp tools and `../code-map.md`.

## Reporting Format

> **Important**: ALWAYS use `tmp/task.md` as your scratchpad for testing and reporting results. DO NOT modify this testing prompt file directly unless there is an error in it.

- ❌ Fail: Tool errors or produces incorrect results (include error message)
- ⚠️ Issue: Unexpected behavior or improvement opportunity
- 📦 Payload: Unnecessarily large response that should be optimized — **blocking, equally important as ❌ bugs**. Oversized payloads waste LLM context window tokens and degrade downstream tool-calling quality. **You MUST monitor `metrics.tokenEstimate` for every operation**.

> **Token estimates**: Code Mode responses include `metrics.tokenEstimate`. Report as ⚠️ if absent.

## Infrastructure Prerequisite

> **Note:** Requires MySQL Router 8.0.17+ with REST API. Configure `mysql-ecosystem` MCP server with `--router-*` parameters.

---

## Group Focus: router

router Tool Group (9 tools +1 code mode):

1. `mysql_router_status` 2. `mysql_router_routes` 3. `mysql_router_route_status`
2. `mysql_router_route_health` 5. `mysql_router_route_connections`
3. `mysql_router_route_destinations` 7. `mysql_router_route_blocked_hosts`
4. `mysql_router_metadata_status` 9. `mysql_router_pool_status`

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.router.help()` → verify method listing
2. `mysql.router.status()` → Router version
3. `mysql.router.routes()` → configured routes
4. `mysql.router.routeStatus({routeName: "bootstrap_rw"})` → status or structured error
5. `mysql.router.routeHealth({routeName: "bootstrap_rw"})` → health check
6. `mysql.router.routeConnections({routeName: "bootstrap_rw"})` → connections
7. `mysql.router.routeDestinations({routeName: "bootstrap_rw"})` → backends
8. `mysql.router.routeBlockedHosts({routeName: "bootstrap_rw"})` → blocked hosts
9. `mysql.router.metadataStatus({metadataName: "bootstrap"})` → metadata cache

**Domain error paths (🔴):**

10. 🔴 `mysql.router.routeStatus({routeName: "nonexistent_xyz"})` → `{success: false}`

**Zod validation error paths (🔴):**

11. 🔴 `mysql.router.routeStatus({})` → `{success: false, error: "Validation error: ..."}`

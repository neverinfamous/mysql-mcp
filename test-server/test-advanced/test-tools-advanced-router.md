# mysql-mcp Advanced Stress Tests: [router]

**ESSENTIAL INSTRUCTIONS**

- Execute ALL tests below using ONLY code mode (`mysql_execute_code`).
- These are second-pass stress tests — basic checklists must pass first.
- Do not skip tests. Return an aggregated `failures` array.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Infrastructure Prerequisite

> **Note:** Requires MySQL Router 8.0.17+ with REST API. Configure `mysql-ecosystem` MCP server with `--router-*` parameters. If Router is unavailable, Category 1 validates graceful degradation. If available, Categories 2–3 validate happy-path stress and input boundaries.

## Pre-requisites

- Basic checklists in `../test-tool-groups-codemode/test-tool-group-codemode-router.md` MUST pass first.

## Post-Test: Fix findings, update changelog, commit without pushing.

---

## Category 1: Graceful Degradation (No-Router Environment)

1. `mysql_router_status()` → verify structured `{success: false}` (not raw connection error)
2. `mysql_router_routes()` → verify structured response
3. `mysql_router_route_status({routeName: "test"})` → verify structured response
4. `mysql_router_route_health({routeName: "test"})` → verify structured response
5. `mysql_router_route_connections({routeName: "test"})` → verify structured response
6. `mysql_router_route_destinations({routeName: "test"})` → verify structured response
7. `mysql_router_route_blocked_hosts({routeName: "test"})` → verify structured response
8. `mysql_router_metadata_status({metadataName: "test"})` → verify structured response
9. `mysql_router_pool_status()` → verify structured response
10. All 9 errors must use consistent `{success: false, error: "..."}` format

## Category 2: Invalid Route Name Stress

11. `mysql_router_route_status({routeName: ""})` → verify structured error (empty string)
12. `mysql_router_route_status({routeName: "nonexistent_route_xyz"})` → verify structured `{success: false}`
13. `mysql_router_route_health({routeName: "'; DROP TABLE test; --"})` → verify structured error (injection attempt)
14. `mysql_router_route_connections({routeName: "a".repeat(256)})` → verify structured error (extremely long name)

## Category 3: Happy-Path Stress (When Router IS Available)

15. `mysql_router_status()` → verify version and process info
16. `mysql_router_routes()` → verify route listing with names
17. For first available route name: `mysql_router_route_status` → verify status fields
18. For first available route name: `mysql_router_route_health` → verify health response
19. For first available route name: `mysql_router_route_connections` → verify connection stats
20. For first available route name: `mysql_router_route_destinations` → verify backend listing

## Category 4: Payload Monitoring

21. `mysql_router_route_connections` → log token estimate
22. `mysql_router_route_destinations` → log token estimate
23. Flag any response > 500 tokens as 📦

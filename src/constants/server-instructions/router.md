# MySQL Router Tools

Tools: `mysql_router_status`, `mysql_router_routes`, `mysql_router_route_status`, `mysql_router_route_health`, `mysql_router_route_connections`, `mysql_router_route_destinations`, `mysql_router_route_blocked_hosts`, `mysql_router_metadata_status`, `mysql_router_pool_status`

- **Prerequisites**: MySQL Router must be running with REST API enabled. The REST API requires an InnoDB Cluster backend for authentication (uses `metadata_cache` credentials).
- **Self-signed certificates**: Set `MYSQL_ROUTER_INSECURE=true` to bypass TLS certificate verification.
- **Server Status**: Use `mysql_router_status` for overall router health/status.
- **Routes & Metadata**: Use `mysql_router_routes` to list available routes (e.g., `bootstrap_rw`, `bootstrap_ro`). Check metadata caching with `mysql_router_metadata_status`.
- **Route Specifics**: Use `mysql_router_route_status`, `mysql_router_route_health`, `mysql_router_route_connections`, `mysql_router_route_destinations`, `mysql_router_route_blocked_hosts` to inspect detailed aspects of a specific route.
- **Metadata cache**: The `metadataName` parameter is typically `bootstrap` for bootstrapped routers.
- **Aliases**: `routeName`, `metadataName`, and `poolName` parameters support `name`, `route`, `metadata`, and `pool` as aliases. Methods like `routeBlockedHosts` also alias to `blockedHosts`.
- **Connection pools**: `mysql_router_pool_status` requires the `[rest_connection_pool]` REST plugin AND `connection_sharing=1` on routes. Pool name is typically `main`. Returns 404/error if disabled.
- **Unavailability handling**: Returns `{ available: false, error: "..." }` or `{ success: false, error: "..." }` instead of throwing when the router is unreachable or a component (404) is missing.

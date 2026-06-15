# MySQL Router Tools (`mysql_router_*`)

- **Prerequisites**: MySQL Router must be running with REST API enabled. The REST API requires an InnoDB Cluster backend for authentication (uses `metadata_cache` credentials).
- **Self-signed certificates**: Set `MYSQL_ROUTER_INSECURE=true` to bypass TLS certificate verification for development/testing environments.
- **Route names**: Use `mysql_router_routes` to list available routes (e.g., `bootstrap_rw`, `bootstrap_ro`).
- **Metadata cache**: The `metadataName` parameter is typically `bootstrap` for bootstrapped routers.
- **Aliases**: `routeName`, `metadataName`, and `poolName` parameters all support `name` as an alias.
- **Connection pools**: `mysql_router_pool_status` requires the `[rest_connection_pool]` REST plugin AND `connection_sharing=1` on routes. Without these, the endpoint returns 404. When enabled, pool name is `main`.
- **Unavailability handling**: When Router REST API is unreachable, tools return `{ available: false, error: "..." }` with descriptive error message instead of throwing. When a specific route, metadata cache, or connection pool name does not exist (404), tools return `{ success: false, error: "..." }` matching the standard error convention.

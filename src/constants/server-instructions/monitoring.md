# Monitoring Tools

Tools: `mysql_show_processlist`, `mysql_show_status`, `mysql_show_variables`, `mysql_innodb_status`, `mysql_replication_status`, `mysql_pool_stats`, `mysql_server_health`

- **Process list**: `mysql_show_processlist` shows active queries. Use `full: true` for complete query text.
- **Status/Variables**: `mysql_show_status` and `mysql_show_variables` accept `like` for filtering (e.g., `like: "%connections%"`) and `limit` to cap rows (default: 100). Response includes `totalAvailable` and `limited: true` when truncated. RSA public key values in status output are automatically redacted.
- **Server health**: `mysql_server_health` returns latency, version, uptime, and pool stats in a single call.
- **Session count**: `GET /health` returns `activeSessions` — the number of active HTTP sessions. Sessions are swept every 60 seconds and expire after 30 minutes idle or 24 hours absolute.
- **InnoDB status**: `mysql_innodb_status` returns InnoDB engine monitor output. Use `summary: true` for parsed key metrics (buffer pool, row ops, transactions).
- **Replication**: `mysql_replication_status` shows replica/slave status. Returns `configured: false` if replication is not set up.
- **Pool stats**: `mysql_pool_stats` returns connection pool metrics (total, active, idle, waiting connections).
- **In-Memory Metrics & Persistence**: The `mysql://metrics` resource provides streaming metrics including p50/p95/p99 latency percentiles, error rates, and content-type-aware token usage for all tool calls and resource reads. If the server is started with an audit log path (e.g., `--audit-log mysql-audit.jsonl`), metrics snapshots are automatically persisted to a local SQLite sidecar (`SystemDb` at the same path) and historical metrics are reloaded across server restarts. If the server is started with `--metrics-export prometheus` (or `MCP_METRICS_EXPORT=prometheus`), these metrics are also exposed via HTTP `GET /metrics` in Prometheus format.

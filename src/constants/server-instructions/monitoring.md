# Monitoring Tools (`mysql_show_processlist`, `mysql_server_health`, etc.)

- **Process list**: `mysql_show_processlist` shows active queries. Use `full: true` for complete query text.
- **Status/Variables**: `mysql_show_status` and `mysql_show_variables` accept `like` for filtering (e.g., `like: "%connections%"`) and `limit` to cap rows (default: 100). Response includes `totalAvailable` and `limited: true` when truncated. RSA public key values in status output are automatically redacted.
- **Server health**: `mysql_server_health` returns latency, version, uptime, and pool stats in a single call.
- **InnoDB status**: `mysql_innodb_status` returns InnoDB engine monitor output. Use `summary: true` for parsed key metrics (buffer pool, row ops, transactions).
- **Replication**: `mysql_replication_status` shows replica/slave status. Returns `configured: false` if replication is not set up.
- **Pool stats**: `mysql_pool_stats` returns connection pool metrics (total, active, idle, waiting connections).

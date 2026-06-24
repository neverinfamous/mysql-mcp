# Replication Tools

Tools: `mysql_master_status`, `mysql_slave_status`, `mysql_binlog_events`, `mysql_gtid_status`, `mysql_replication_lag`

- **Master status**: `mysql_master_status` returns current binlog file, position, and GTID set from the source server.
- **Slave status**: `mysql_slave_status` returns detailed replica status. Returns `configured: false` if not a replica.
- **Binlog events**: `mysql_binlog_events` shows binary log events. Use `logFile`, `position`, and `limit` (default: 5) to filter. Defaults to the **current** binlog file when `logFile` is omitted. Returns `{ success: false, error }` gracefully for nonexistent binlog files.
- **GTID status**: `mysql_gtid_status` shows GTID mode (ON/OFF) and executed/purged transaction sets.
- **Replication lag**: `mysql_replication_lag` calculates delay in seconds. Returns `lagSeconds: null` if not a replica.

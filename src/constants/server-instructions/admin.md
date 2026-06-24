# Admin Tools (`mysql_optimize_table`, `mysql_server_config`, etc.)

**Encapsulated Tools**: `mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, `mysql_repair_table`, `mysql_flush_tables`, `mysql_kill_query`, `mysql_append_insight`, `mysql_server_config`, `mysql_audit_search`

### Table Maintenance (`mysql_optimize_table`, `mysql_analyze_table`, `mysql_check_table`, `mysql_repair_table`)
- **Optimize**: Reclaims unused space (InnoDB recreates + analyzes).
- **Analyze**: Updates index statistics for the query optimizer.
- **Check**: Verifies table integrity (Options: QUICK, FAST, MEDIUM, EXTENDED, CHANGED).
- **Repair**: Only works for MyISAM. InnoDB returns "not supported".
- **Error Handling**: Return MySQL's native per-table `results` array. Missing tables are intercepted to return a structured error with `code: "MAINTENANCE_ERROR"`.

### Database Admin (`mysql_flush_tables`, `mysql_kill_query`, `mysql_server_config`)
- **Flush**: Writes cached changes to disk. If some specified tables don't exist, valid tables are flushed and it returns `{ success: false, notFound, flushed }`. Global flush (no table arguments) always succeeds.
- **Kill Query**: Terminates by process ID.
  ```json
  { "processId": 1234, "connection": true } // connection:true kills entire connection
  ```
  - Returns `{ success: false, error }` for invalid IDs.
- **Server Config**: Dynamically updates or fetches runtime variables without restarts (e.g., `logLevel`).

### Auditing & Insights (`mysql_audit_search`, `mysql_append_insight`)
- **Audit Search**: Queries system audit logs for specific actions, users, or timeframes. Defaults to `limit: 10` for payload efficiency.
- **Insight Append**: Records business insights to an in-memory memo.
  - Access via `mysql://insights` resource.
  - Max 1000 chars per insight.

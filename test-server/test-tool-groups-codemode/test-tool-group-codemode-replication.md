# mysql-mcp Code Mode Re-Testing: [replication]

**ESSENTIAL INSTRUCTIONS**

- Conduct an exhaustive test using ONLY code mode (`mysql_execute_code`).
- Do not modify or skip tests. Return an aggregated `failures` array.
- All changes MUST be consistent with other mysql-mcp tools and `code-map.md`.

## Reporting: ❌ Fail | ⚠️ Issue | 📦 Payload (monitor `metrics.tokenEstimate`)

## Requirements

1. 
2. 

---

## Group Focus: replication

replication Tool Group (5 tools +1 code mode):

1. `mysql_master_status` 2. `mysql_slave_status` 3. `mysql_binlog_events`
4. `mysql_gtid_status` 5. `mysql_replication_lag`

> **Note**: In a single-server test environment, most will return status-only results. Focus on structured error responses.

> **Instructions**: Use `mysql.*` namespace, push deviations to `failures` array.

1. `mysql.replication.help()` → verify method listing
2. `mysql.replication.masterStatus()` → binlog file, position
3. `mysql.replication.slaveStatus()` → structured response (may indicate no replication)
4. `mysql.replication.gtidStatus()` → GTID information
5. `mysql.replication.binlogEvents({limit: 5})` → binlog events
6. `mysql.replication.replicationLag()` → response (0 lag or no-replica)

**Zod validation error paths (🔴):**

7. 🔴 `mysql.replication.binlogEvents({logFile: 123})` → must NOT return raw MCP error (wrong type)

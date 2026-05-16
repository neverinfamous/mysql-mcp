# Resource Testing Prompt

## Resource Testing

mysql-mcp exposes 18 `mysql://` resources. Many query internal views (`performance_schema`, `sys`, `information_schema`) that need prior activity to return meaningful data.

### Setup

```powershell
# 1. Reset base tables
.\test-server\reset-database.ps1

# 2. Seed resource data (warms up statistics, creates test events)
Get-Content .\test-server\test-resources.sql -Raw | docker exec -i mysql-final mysql -uroot -proot testdb
```

## Prompt

**Step 1:** Read `C:\Users\chris\Desktop\mysql-mcp\test-server\test-resources.sql` to understand what resource seed data has been set up.

**Step 2:** Test all 18 `mysql://` resources by reading each resource URI. For each resource, validate the output against the expected structure documented below.

### All 18 Resources

| #   | Resource URI           | Expected Output Shape                          | Pass Criteria                                                             |
| --- | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `mysql://schema`       | `{ tables: [...] }`                            | Returns array of table definitions with columns                           |
| 2   | `mysql://tables`       | `{ tables: [...] }`                            | Returns 12+ tables (test\_\* tables from test-seed.sql)                   |
| 3   | `mysql://variables`    | `{ variables: [...] }` or key-value pairs      | Returns MySQL server variables                                            |
| 4   | `mysql://status`       | `{ status: [...] }` or key-value pairs         | Returns global status counters (Uptime > 0)                               |
| 5   | `mysql://processlist`  | `{ processes: [...] }`                         | Returns at least 1 active connection                                      |
| 6   | `mysql://pool`         | Pool statistics object                         | Returns connection pool state                                             |
| 7   | `mysql://capabilities` | `{ version, features, ... }`                   | Returns MySQL version and feature flags                                   |
| 8   | `mysql://health`       | `{ status, metrics, ... }`                     | Returns health assessment with numeric metrics                            |
| 9   | `mysql://performance`  | `{ summary, top_queries, ... }`                | `summary.total_queries > 0`, `top_queries` non-empty                      |
| 10  | `mysql://indexes`      | `{ indexes: [...] }`                           | Returns index info for test tables (idx*products*\*, etc.)                |
| 11  | `mysql://replication`  | Replication status object                      | Returns binlog position; replicas may be empty                            |
| 12  | `mysql://innodb`       | `{ bufferPool, ... }`                          | Returns InnoDB buffer pool stats with non-zero reads                      |
| 13  | `mysql://events`       | `{ schedulerEnabled, events: [...] }`          | `schedulerEnabled: true`, events array includes `test_resource_event`     |
| 14  | `mysql://sysschema`    | `{ available, topUsers, slowStatements, ... }` | `available: true`, `topUsers` non-empty                                   |
| 15  | `mysql://locks`        | `{ currentLockWaits, lockStatistics, ... }`    | `lockStatistics` has InnoDB row lock counters; `lockWaits` may be empty   |
| 16  | `mysql://cluster`      | `{ groupReplicationEnabled, ... }`             | Returns `groupReplicationEnabled: false` on standalone; `true` on cluster |
| 17  | `mysql://spatial`      | `{ spatialColumns, spatialIndexes, ... }`      | `spatialColumnCount >= 1` (test_locations.geom), `spatialIndexCount >= 1` |
| 18  | `mysql://docstore`     | `{ collections, ... }`                         | `collectionCount >= 1` (test_documents detected)                          |

### How to Read Resources

Use the MCP resource reading mechanism. In AntiGravity, you can read resources using the `read_resource` tool with:

- **ServerName**: `mysql`
- **Uri**: The resource URI (e.g., `mysql://schema`)

Read each resource one at a time (or in parallel batches of 3-4) and validate the output.

### Reporting Format

For each resource, report:

- ✅ **Pass**: Resource returns expected data shape with meaningful content
- ⚠️ **Partial**: Resource returns correct shape but some fields are empty/zero (note which fields and whether expected)
- ❌ **Fail**: Resource errors, returns wrong shape, or returns unexpectedly empty data

### Final Summary

Provide a summary table of all 18 resources with their pass/partial/fail status. List any issues that require code fixes (e.g., resource handler bugs, missing error handling) separately from infrastructure-dependent limitations.

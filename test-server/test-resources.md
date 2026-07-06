# Resource Testing Plan

[![Tools](https://img.shields.io/badge/Tools-241-blue?style=for-the-badge)](#)
[![Resources](https://img.shields.io/badge/Resources-23-green?style=for-the-badge)](#)
[![Prompts](https://img.shields.io/badge/Prompts-19-purple?style=for-the-badge)](#)
<br>
[![OAuth 2.1](https://img.shields.io/badge/OAuth-2.1-red?style=for-the-badge)](#)
[![Code Mode](https://img.shields.io/badge/Code-Mode-orange?style=for-the-badge)](#)

## Value Proposition
Build AI integrations instantly.
Empower agents with secure database access.
Execute complex logic via Code Mode.
Scale operations with robust connection pooling.
Leverage OAuth 2.1 for enterprise security.

mysql-mcp exposes 23 core mysql:// observability resources (plus help). Many query internal views (`performance_schema`, `sys`, `information_schema`) that need prior activity to return meaningful data.

### Setup

```powershell
# 1. Reset base tables
node scripts/reset-database.mjs

# 2. Seed resource data (warms up statistics, creates test events)
Get-Content .\test-server\test-resources.sql -Raw | docker exec -i mysql-final mysql -uroot -proot testdb
```

## Prompt

**Step 1:** Read `C:\Users\chris\Desktop\mysql-mcp\test-server\test-resources.sql` to understand what resource seed data has been set up.

**Step 2:** Test all 23 resource URIs by reading the core resource URIs. For each resource, validate the output against the expected structure documented below.

### Core Resources

| #   | Resource URI           | Expected Output Shape                          | Pass Criteria                                                             |
| --- | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | `mysql://schema`       | `{ tables: [...] }`                            | Returns array of table definitions with columns                           |
| 2   | `mysql://tables`       | `{ tables: [...] }`                            | Returns 11+ tables (test\_* tables from test-seed.sql)                   |
| 3   | `mysql://table/{name}` | `{ table: "...", schema: [...] }`              | Returns schema definition for a specific table (e.g., test_products)      |
| 4   | `mysql://variables`    | `{ variables: [...] }` or key-value pairs      | Returns MySQL server variables                                            |
| 5   | `mysql://status`       | `{ status: [...] }` or key-value pairs         | Returns global status counters (Uptime > 0)                               |
| 6   | `mysql://processlist`  | `{ processes: [...] }`                         | Returns at least 1 active connection                                      |
| 7   | `mysql://pool`         | Pool statistics object                         | Returns connection pool state                                             |
| 8   | `mysql://capabilities` | `{ version, features, ... }`                   | Returns MySQL version and feature flags                                   |
| 9   | `mysql://health`       | `{ status, metrics, ... }`                     | Returns health assessment with numeric metrics                            |
| 10  | `mysql://performance`  | `{ summary, top_queries, ... }`                | `summary.total_queries > 0`, `top_queries` non-empty                      |
| 11  | `mysql://indexes`      | `{ indexes: [...] }`                           | Returns index info for test tables (idx*products*\*, etc.)                |
| 12  | `mysql://replication`  | Replication status object                      | Returns binlog position; replicas may be empty                            |
| 13  | `mysql://innodb`       | `{ bufferPool, ... }`                          | Returns InnoDB buffer pool stats with non-zero reads                      |
| 14  | `mysql://events`       | `{ schedulerEnabled, events: [...] }`          | `schedulerEnabled: true`, events array includes `test_resource_event`     |
| 15  | `mysql://sysschema`    | `{ available, topUsers, slowStatements, ... }` | `available: true`, `topUsers` non-empty                                   |
| 16  | `mysql://locks`        | `{ currentLockWaits, lockStatistics, ... }`    | `lockStatistics` has InnoDB row lock counters; `lockWaits` may be empty   |
| 17  | `mysql://cluster`      | `{ groupReplicationEnabled, ... }`             | Returns `groupReplicationEnabled: false` on standalone; `true` on cluster |
| 18  | `mysql://spatial`      | `{ spatialColumns, spatialIndexes, ... }`      | `spatialColumnCount >= 1` (test_locations.geom), `spatialIndexCount >= 1` |
| 19  | `mysql://docstore`     | `{ collections, ... }`                         | `collectionCount >= 1` (test_documents detected)                          |
| 20  | `mysql://insights`     | String text                                    | Returns a memo string from insights logging                               |
| 21  | `mysql://metrics`      | `{ tools, resources, timestamp }`              | Returns populated metrics object tracking telemetry                       |
| 22  | `mysql://audit-log`    | `{ entries: [...], ... }`                      | Returns forensic audit trail object                                       |
| 23  | `mysql://help`         | Markdown text                                  | Returns API reference documentation                                       |

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

Provide a summary table of all 23 resources with their pass/partial/fail status. List any issues that require code fixes (e.g., resource handler bugs, missing error handling) separately from infrastructure-dependent limitations.

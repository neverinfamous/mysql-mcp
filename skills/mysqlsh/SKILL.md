---
name: mysqlsh
version: 1.0.0
tags:
  - "agent-skill"
triggers:
  - MySQL Shell
  - mysqlsh
  - AdminAPI
  - util.dumpInstance
  - util.loadDump
  - InnoDB ClusterSet
  - InnoDB ReplicaSet
exclude:
  - "generic MySQL queries without ecosystem context"
  - "ORM-managed migrations"
  - Postgres
  - PostgreSQL
  - SQLite
description: |
  Production standards for MySQL Shell (mysqlsh), the advanced client and automation tool for MySQL.
  Use when configuring or troubleshooting AdminAPI (InnoDB Cluster management), parallel dump/load utilities, data import/export, or scripting automation.
  Triggers on: "MySQL Shell", "mysqlsh", "AdminAPI", "util.dumpInstance".
  Do NOT trigger for basic MySQL queries or schema design (use `mysql` skill).
references:
  - mysql
  - mysql-mcp
---

# MySQL Shell (mysqlsh) Production Standards

MySQL Shell is an advanced client and automation tool with JavaScript, Python, and SQL modes. It is the **only supported interface** for InnoDB Cluster management via the AdminAPI.

## 1. Execution Modes

| Mode | Activate | Use Case |
|---|---|---|
| SQL (`\sql`) | `--sql` | Ad-hoc querying |
| JavaScript (`\js`) | `--js` | AdminAPI, automation, `util.*` functions |
| Python (`\py`) | `--py` | AdminAPI, automation, `util.*` functions |

- **[ALWAYS]** use `\js` or `\py` modes for administrative and automation tasks.
- **[ALWAYS]** use `\sql` mode strictly for ad-hoc querying.

## 2. AdminAPI & InnoDB Cluster Management

The `dba` global object (AdminAPI) is the **only recommended way** to deploy and manage InnoDB Cluster, ClusterSet, and ReplicaSet topologies.

**Setup Rules:**
- **[ALWAYS]** run `dba.configureInstance('user@host:3306')` before adding a node. It validates prerequisites (Performance Schema, InnoDB engine, `server_id`).
- **[ALWAYS]** create a dedicated cluster admin account via the `clusterAdmin` option.
- **[ALWAYS]** require an odd number of nodes (minimum 3) for quorum, distributed across different physical fault domains.
- **[ALWAYS]** use stable hostnames defined in DNS or `/etc/hosts`.
- **[NEVER]** use `dba.deploySandboxInstance()` for production. It is for local testing only.

**Example:**
```javascript
dba.configureInstance('admin@node1:3306')
var cluster = dba.createCluster('myCluster')
cluster.addInstance('admin@node2:3306')
cluster.addInstance('admin@node3:3306')
cluster.status()
```

**Key AdminAPI Operations:**
| Method | Purpose |
|---|---|
| `dba.createCluster()` | Create new InnoDB Cluster |
| `dba.getCluster()` | Get handle to existing cluster |
| `cluster.addInstance()` | Add node to cluster |
| `cluster.removeInstance()` | Remove node from cluster |
| `cluster.status()` | Full topology status |
| `cluster.switchToMultiPrimaryMode()` | Switch to multi-primary |
| `cluster.switchToSinglePrimaryMode()` | Switch to single-primary |
| `cluster.setPrimaryInstance()` | Force primary election |
| `cluster.rescan()` | Re-scan for topology changes |
| `dba.createClusterSet()` | Create multi-datacenter ClusterSet |

## 3. Dump & Load Utilities (`util.*`)

MySQL Shell utilities process data in parallel with chunking, making them **10-20x faster** than legacy `mysqldump`.

**Dump Best Practices:**
- **[ALWAYS]** use `threads: N` matched to CPU capacity.
- **[ALWAYS]** keep default `compression: "zstd"` for high compression ratios with fast I/O.
- Default `chunking: true` with `bytesPerChunk: "64M"` splits large tables automatically.
- **[CRITICAL]** Large tables **MUST** have Primary Keys for chunked parallel dumps to work. Tables without suitable indexes fall back to single-file dumps.

**Load Best Practices:**
- **[ALWAYS]** defer index creation: `deferTableIndexes: "all"`.
- **[ALWAYS]** disable binary logging on target if point-in-time recovery isn't needed: `skipBinlog: true`.
- **[ALWAYS]** use `progressFile` (e.g., `progressFile: "/tmp/load.json"`) to enable resuming if interrupted.
- **[ALWAYS]** use `{dryRun: true}` before executing massive load operations to surface partition failures or missing privileges.

**Example:**
```javascript
// Dump entire instance
util.dumpInstance("/backup/dir", {threads: 16, compression: "zstd"})

// Load with performance optimizations
util.loadDump("/backup/dir", {
  threads: 16,
  deferTableIndexes: "all",
  skipBinlog: true,
  progressFile: "/tmp/load.json"
})
```

**MCP Tools Mapping:**
| Shell Feature / Function | MCP Tool |
|---|---|
| Version Info | `mysqlsh_version` |
| Script Execution | `mysqlsh_run_script` |
| `util.dumpInstance()` | `mysqlsh_dump_instance` |
| `util.dumpSchemas()` | `mysqlsh_dump_schemas` |
| `util.dumpTables()` | `mysqlsh_dump_tables` |
| `util.loadDump()` | `mysqlsh_load_dump` |
| `util.exportTable()` | `mysqlsh_export_table` |
| `util.importTable()` | `mysqlsh_import_table` |
| `util.importJson()` | `mysqlsh_import_json` |
| `util.checkForServerUpgrade()` | `mysqlsh_check_upgrade` |

## 4. Upgrade Checker

`util.checkForServerUpgrade()` performs pre-flight compatibility checks before MySQL version upgrades.

```javascript
util.checkForServerUpgrade('user@host', {targetVersion: "8.4.0"})
```

- Output categorized into **Errors** (must fix), **Warnings**, and **Notices**.
- **[ALWAYS]** run on a replica instance first to avoid impacting production.

## 5. Scripting & Batch Automation

```bash
# Execute script (auto-detects mode by extension)
mysqlsh --file=migrate.js -- --target prod

# Force JavaScript mode
mysqlsh --js --file=migrate.js
```

- **[ALWAYS]** wrap scripts in `try-catch` / `try-except` blocks.
- **[ALWAYS]** use `--login-path` or environment secrets. **[NEVER]** pass plaintext passwords via CLI flags.
- Access CLI arguments via `os.argv` (JS) or `sys.argv` (Python).

## 6. Security

- **[NEVER]** use plaintext passwords (`-p`) in CLI flags — they leak into shell history.
- **[ALWAYS]** use `mysql_config_editor` to store credentials in `~/.mylogin.cnf`:
  ```bash
  mysql_config_editor set --login-path=prod-db --host=db.example.com --user=admin --password
  mysqlsh --login-path=prod-db
  ```
- Restrict file permissions: `chmod 600 ~/.mylogin.cnf`.

## 7. MCP Configuration

```bash
# Path to mysqlsh binary (if not in PATH)
MYSQLSH_PATH=/usr/bin/mysqlsh

# Working directory for dump/load operations
MYSQLSH_WORK_DIR=/tmp/mysql-dumps

# Timeout for shell commands (ms, default: 300000 = 5 min)
MYSQLSH_TIMEOUT=300000
```

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `mysqlsh not found` | Binary not in PATH | Set `MYSQLSH_PATH` env var |
| Permission denied | Work directory permissions | Ensure `MYSQLSH_WORK_DIR` is writable |
| Timeout on large dumps | Default 5-min timeout too low | Increase `MYSQLSH_TIMEOUT` |
| Load fails mid-way | Disk space or inode exhaustion | Check available space; resume with same `progressFile` |
| Deadlocks during load | Concurrent chunk inserts | Shell auto-retries deadlock errors (1213) |

> [!CAUTION]
> **[NEVER]** modify dump files if you intend to resume a load. Fix the schema mismatch on the DB side and re-run with the same `progressFile`, or restart with `resetProgress: true`.

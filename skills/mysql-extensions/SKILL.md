---
name: mysql-extensions
version: 1.0.0
tags:
  - "agent-skill"
triggers:
  - MySQL Router
  - mysqlrouter
  - mysqlrouter.conf
  - MySQL Shell
  - mysqlsh
  - AdminAPI
  - ProxySQL
  - proxysql
  - InnoDB Cluster
  - InnoDB ClusterSet
  - InnoDB ReplicaSet
  - util.dumpInstance
  - util.loadDump
  - connection multiplexing
  - query routing
  - hostgroup
  - read-write splitting
exclude:
  - "generic MySQL queries without ecosystem context"
  - "ORM-managed migrations"
  - Postgres
  - PostgreSQL
  - SQLite
description: |
  Production standards for MySQL Router, MySQL Shell (mysqlsh), and ProxySQL —
  the three ecosystem extensions used heavily in mysql-mcp.
  Use when configuring, troubleshooting, or making architectural decisions about
  HA routing, connection pooling/multiplexing, query routing, backup/restore
  utilities, InnoDB Cluster management, or upgrade tooling.
  Triggers on: "MySQL Router", "mysqlsh", "AdminAPI", "ProxySQL", "InnoDB Cluster",
  "util.dumpInstance", "connection multiplexing", "query routing", "hostgroup".
  Do NOT trigger for basic MySQL queries or schema design (use `mysql` skill).
  Do NOT trigger for mysql-mcp server configuration or Code Mode (use `mysql-mcp` skill).
references:
  - mysql
  - mysql-mcp
---

# MySQL Ecosystem Extensions: Router, Shell & ProxySQL

Production standards and behavioral rules for the three ecosystem components that extend MySQL's capabilities beyond the core database engine. These components are first-class citizens in the `mysql-mcp` server's tool catalog.

> [!NOTE]
> **Version Notice (2026)**: Target **MySQL 8.4 LTS** or **9.0+** for production. MySQL 8.0 reached EOL in April 2026. Innovation releases (9.x) move fast and may deprecate features quicker than LTS. Router, Shell, and ProxySQL version alignment with the server version is strongly recommended.

---

## 1. MySQL Router

MySQL Router is lightweight middleware providing transparent routing between applications and MySQL servers, purpose-built for InnoDB Cluster high availability.

### 1.1 Architecture & Bootstrap

- **Bootstrap-First**: **[ALWAYS]** use `mysqlrouter --bootstrap user@primary:3306 --directory /etc/mysqlrouter --user mysqlrouter` for InnoDB Cluster deployments. Bootstrap auto-discovers topology, creates internal router accounts, generates `mysqlrouter.conf`, and registers the router in `mysql_innodb_cluster_metadata`.
- **Never Manual for Clusters**: **[NEVER]** manually configure cluster node addresses in `mysqlrouter.conf`. Always rely on bootstrap + metadata cache for automatic failover discovery.
- **Metadata Cache**: Router maintains a persistent connection to the cluster, polling `performance_schema` for topology changes. Tune the TTL (e.g., `ttl=0.5`) for faster failover detection when needed.

### 1.2 Routing Strategies

| Strategy | Use Case | Default Port |
|---|---|---|
| `first-available` | Primary writes (fails over to next available) | 6446 (R/W) |
| `round-robin` | Read distribution across replicas | 6447 (R/O) |
| `round-robin-with-fallback` | HA reads with fallback to primary | — |
| `next-available` | Sticky connections | — |

- **Read/Write Splitting**: Router natively separates write traffic (port 6446 → primary) and read traffic (port 6447 → secondaries). Applications MUST use distinct connection strings for reads vs writes.
- **Sidecar Deployment**: **[ALWAYS]** deploy Router as close to the application layer as possible (e.g., as a sidecar container) to eliminate single points of failure and minimize network latency.

### 1.3 Connection Sharing (8.0.33+ / 8.4 LTS)

- **Mechanism**: Instead of terminating server connections on client disconnect, idle connections are pooled and reused. Governed by `connection_sharing_delay`.
- **Limitations**: Unsupported in `PASSTHROUGH` mode. Sessions using `GET_LOCK()` or `LAST_INSERT_ID()` may prevent safe pooling.
- **MCP Tool**: `mysql_router_pool_status` requires `connection_sharing=1` on at least one route to return data.

### 1.4 REST API & Monitoring

Router exposes a JSON REST API for monitoring (read-only). Enable via config sections:

```ini
[rest_api]
require_realm = default_realm

[rest_router]
require_realm = default_realm

[rest_metadata_cache]
require_realm = default_realm

[rest_connection_pool]
require_realm = default_realm

[http_server]
port = 8443
ssl = 1
ssl_cert = /path/to/router-cert.pem
ssl_key = /path/to/router-key.pem
```

**Key Endpoints** (used by `mysql-mcp` Router tools):
- `/router/status` — Process health, version, uptime
- `/routes` — List all configured routes
- `/routes/{name}/destinations` — Active routing nodes
- `/routes/{name}/connections` — Active connections per route
- `/routes/{name}/blockedHosts` — Blocked hosts per route
- `/routes/{name}/health` — Route health status
- `/metadata/{name}/status` — Metadata cache status

**MCP Environment Variables:**
```bash
MYSQL_ROUTER_URL=http://localhost:8443
MYSQL_ROUTER_USERNAME=admin
MYSQL_ROUTER_PASSWORD=your_password
MYSQL_ROUTER_INSECURE=true  # For self-signed certs
```

### 1.5 TLS/SSL

Router handles two distinct encrypted segments:

```ini
[DEFAULT]
# Client-to-Router
client_ssl_mode = REQUIRED
client_ssl_cert = /path/to/router-cert.pem
client_ssl_key = /path/to/router-key.pem

# Router-to-Server
server_ssl_mode = REQUIRED
server_ssl_ca = /path/to/ca.pem
server_ssl_verify = TRUE
```

> [!WARNING]
> Running `--bootstrap` can overwrite manual TLS settings. Use the `--conf-set-option` flag during bootstrap to preserve custom TLS rules.

### 1.6 Performance Tuning

- **`max_total_connections`**: Global limit (default: 512). Set to ~120% of peak `Max_used_connections` on the MySQL server. Excessive values exhaust RAM due to per-thread memory overhead.
- **Anti-Pattern**: **[NEVER]** treat Router as a fix for application connection leaks. Always implement robust connection pooling at the application layer.

### 1.7 Docker Deployment

- **Official Image**: `container-registry.oracle.com/mysql/community-router:8.4`
- **Env-Driven Bootstrap**: Use `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`.
- **Persistence**: Mount `/etc/mysqlrouter` as a volume to persist bootstrapped configuration across restarts.
- **Ordering**: In `docker-compose`, use `depends_on` with health checks to ensure Router waits for InnoDB Cluster health before bootstrapping.

### 1.8 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Connection refused | Router daemon not running or ports blocked | Verify `mysqlrouter` process; check firewall rules |
| Stale metadata / failed failover | Metadata cache TTL too high | Lower `ttl` (e.g., `0.5`) for faster topology checks |
| SSL errors | Self-signed certs without skip flag | Set `MYSQL_ROUTER_INSECURE=true` for dev |
| No destinations | Backend servers unhealthy | Check backend MySQL instance status |

> [!IMPORTANT]
> Applications **MUST** handle disconnects and retry connection establishment during failover. Router does **NOT** replay in-flight queries that fail mid-failover.

---

## 2. MySQL Shell (mysqlsh)

MySQL Shell is an advanced client and automation tool with JavaScript, Python, and SQL modes. It is the **only supported interface** for InnoDB Cluster management via the AdminAPI.

### 2.1 Execution Modes

| Mode | Activate | Use Case |
|---|---|---|
| SQL (`\sql`) | `--sql` | Ad-hoc querying |
| JavaScript (`\js`) | `--js` | AdminAPI, automation, `util.*` functions |
| Python (`\py`) | `--py` | AdminAPI, automation, `util.*` functions |

- **[ALWAYS]** use `\js` or `\py` modes for administrative and automation tasks.
- **[ALWAYS]** use `\sql` mode strictly for ad-hoc querying.

### 2.2 AdminAPI & InnoDB Cluster Management

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

### 2.3 Dump & Load Utilities (`util.*`)

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
| `util.*` Function | MCP Tool |
|---|---|
| `util.dumpInstance()` | `mysqlsh_dump_instance` |
| `util.dumpSchemas()` | `mysqlsh_dump_schemas` |
| `util.dumpTables()` | `mysqlsh_dump_tables` |
| `util.loadDump()` | `mysqlsh_load_dump` |
| `util.exportTable()` | `mysqlsh_export_table` |
| `util.importTable()` | `mysqlsh_import_table` |
| `util.importJson()` | `mysqlsh_import_json` |
| `util.checkForServerUpgrade()` | `mysqlsh_check_upgrade` |

### 2.4 Upgrade Checker

`util.checkForServerUpgrade()` performs pre-flight compatibility checks before MySQL version upgrades.

```javascript
util.checkForServerUpgrade('user@host', {targetVersion: "8.4.0"})
```

- Output categorized into **Errors** (must fix), **Warnings**, and **Notices**.
- **[ALWAYS]** run on a replica instance first to avoid impacting production.

### 2.5 Scripting & Batch Automation

```bash
# Execute script (auto-detects mode by extension)
mysqlsh --file=migrate.js -- --target prod

# Force JavaScript mode
mysqlsh --js --file=migrate.js
```

- **[ALWAYS]** wrap scripts in `try-catch` / `try-except` blocks.
- **[ALWAYS]** use `--login-path` or environment secrets. **[NEVER]** pass plaintext passwords via CLI flags.
- Access CLI arguments via `os.argv` (JS) or `sys.argv` (Python).

### 2.6 Security

- **[NEVER]** use plaintext passwords (`-p`) in CLI flags — they leak into shell history.
- **[ALWAYS]** use `mysql_config_editor` to store credentials in `~/.mylogin.cnf`:
  ```bash
  mysql_config_editor set --login-path=prod-db --host=db.example.com --user=admin --password
  mysqlsh --login-path=prod-db
  ```
- Restrict file permissions: `chmod 600 ~/.mylogin.cnf`.

### 2.7 MCP Configuration

```bash
# Path to mysqlsh binary (if not in PATH)
MYSQLSH_PATH=/usr/bin/mysqlsh

# Working directory for dump/load operations
MYSQLSH_WORK_DIR=/tmp/mysql-dumps

# Timeout for shell commands (ms, default: 300000 = 5 min)
MYSQLSH_TIMEOUT=300000
```

### 2.8 Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `mysqlsh not found` | Binary not in PATH | Set `MYSQLSH_PATH` env var |
| Permission denied | Work directory permissions | Ensure `MYSQLSH_WORK_DIR` is writable |
| Timeout on large dumps | Default 5-min timeout too low | Increase `MYSQLSH_TIMEOUT` |
| Load fails mid-way | Disk space or inode exhaustion | Check available space; resume with same `progressFile` |
| Deadlocks during load | Concurrent chunk inserts | Shell auto-retries deadlock errors (1213) |

> [!CAUTION]
> **[NEVER]** modify dump files if you intend to resume a load. Fix the schema mismatch on the DB side and re-run with the same `progressFile`, or restart with `resetProgress: true`.

---

## 3. ProxySQL

ProxySQL is a high-performance MySQL proxy providing connection multiplexing, query routing, caching, and firewalling. It excels in complex architectures requiring granular traffic control.

### 3.1 Architecture & Three-Layer Configuration

ProxySQL uses a strict multi-layer configuration system designed for dynamic, zero-downtime updates:

| Layer | Purpose | Mutability |
|---|---|---|
| **MEMORY** | Staging area (in-memory SQLite). Modifications here do NOT impact traffic. | Read/Write |
| **RUNTIME** | Active in-memory data structures used by worker threads. Dictates proxy behavior. | Read-only |
| **DISK** | Persistent SQLite DB (`proxysql.db`). Survives restarts. | Via SAVE |

**Configuration Workflow (CRITICAL):**
```sql
-- Step 1: Make changes in MEMORY layer
INSERT INTO mysql_servers (hostgroup_id, hostname, port) VALUES (0, 'primary', 3306);

-- Step 2: Apply to RUNTIME (takes effect immediately)
LOAD MYSQL SERVERS TO RUNTIME;

-- Step 3: Persist to DISK (survives restarts)
SAVE MYSQL SERVERS TO DISK;
```

> [!CAUTION]
> The #1 ProxySQL mistake: Modifying admin tables and assuming changes take effect. You **MUST** run `LOAD <MODULE> TO RUNTIME` for changes to activate, and `SAVE <MODULE> TO DISK` for persistence. Forgetting either step is the root cause of most ProxySQL configuration issues.

> [!WARNING]
> Some global variables (`mysql-interfaces`, `mysql-threads`) require `SAVE ... TO DISK` **and** a full service restart — `LOAD TO RUNTIME` alone is insufficient.

### 3.2 Connection Multiplexing

Multiplexing lets thousands of frontend clients share a small pool of backend connections, solving the C10K problem.

**Anti-Patterns That Kill Multiplexing** (result in "pinned" connections):
- Active transactions (`BEGIN` without `COMMIT`/`ROLLBACK`)
- Temporary table creation
- User-defined variables (`SET @var`)
- Session-level state modifications (`SET FOREIGN_KEY_CHECKS`)
- Held prepared statements (binary protocol statement IDs are tied to specific backend connections)
- Long-running transactions

**[ALWAYS]** close prepared statements immediately after use. **[ALWAYS]** keep transactions as short as possible. **[ALWAYS]** avoid `SET @var` in application code routed through ProxySQL.

### 3.3 Query Routing & Rules

Routing is configured in the `mysql_query_rules` table using hostgroup-based destination routing.

**Rule Ordering:**
- Rules are evaluated sequentially by `rule_id` (ascending).
- **[ALWAYS]** place highly specific rules (e.g., `^SELECT .* FOR UPDATE`) at the lowest `rule_id`.
- **[ALWAYS]** place generic catch-all rules (e.g., `^SELECT`) at higher `rule_id`s.

**Performance:**
- **[ALWAYS]** use `match_digest` (normalized query) instead of `match_pattern` (full query regex) for better performance.
- **[ALWAYS]** set `apply=1` to terminate rule evaluation on first match.

**Example:**
```sql
-- Route SELECT FOR UPDATE to writers (hostgroup 0)
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES (1, 1, '^SELECT.*FOR UPDATE', 0, 1);

-- Route other SELECTs to readers (hostgroup 1)
INSERT INTO mysql_query_rules (rule_id, active, match_pattern, destination_hostgroup, apply)
VALUES (2, 1, '^SELECT', 1, 1);

LOAD MYSQL QUERY RULES TO RUNTIME;
SAVE MYSQL QUERY RULES TO DISK;
```

### 3.4 Query Cache

ProxySQL provides transparent query result caching (TTL-based eviction only — no active invalidation).

- **[ALWAYS]** target high-cost, frequently executed, read-heavy queries that produce stable results.
- **[ALWAYS]** set conservative soft limits: `mysql-query_cache_size_MB` (e.g., 256–512 MB).
- **[NEVER]** cache everything. Indiscriminate caching causes stale data and OOM issues.
- **Limitation**: Incompatible with prepared statements.

### 3.5 Backend Server Management

```sql
-- Add primary (hostgroup 0 = writers)
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight, max_connections)
VALUES (0, 'primary', 3306, 1000, 100);

-- Add replicas (hostgroup 1 = readers)
INSERT INTO mysql_servers (hostgroup_id, hostname, port, weight, max_connections)
VALUES (1, 'replica1', 3306, 500, 100),
       (1, 'replica2', 3306, 500, 100);

LOAD MYSQL SERVERS TO RUNTIME;
SAVE MYSQL SERVERS TO DISK;
```

- **Health Checks**: ProxySQL continuously probes connectivity, pings, and replication lag via a dedicated monitor user. Configure frequencies via `mysql-monitor_ping_interval`.
- **Weights**: Proportional load balancing within a hostgroup (weight 3 receives 3x traffic of weight 1).
- **Runtime Shunning**: If a backend fails during actual query execution, ProxySQL shuns it instantly — even if the background ping succeeded.

### 3.6 User Management & Authentication

- **`caching_sha2_password`**: Fully supported in ProxySQL **2.6.0+** for both frontend and backend connections. Earlier versions only supported it for backend connections.
- **[ALWAYS]** use SSL when using hashed passwords with `caching_sha2_password`.
- **[ALWAYS]** run `LOAD MYSQL USERS TO RUNTIME; SAVE MYSQL USERS TO DISK;` after user changes.

### 3.7 Query Digest & Analytics

The `stats_mysql_query_digest` table provides runtime query analytics:

```sql
-- Find slowest queries by average execution time
SELECT digest, SUBSTR(digest_text, 1, 80),
       count_star, sum_time, sum_time/count_star AS avg_time_us
FROM stats_mysql_query_digest
ORDER BY avg_time_us DESC LIMIT 20;
```

- Use to identify caching candidates, slow queries, and query distribution patterns.
- **[CAUTION]** High volumes of unique, non-parameterized queries bloat this table. Safely truncate with `DELETE FROM stats_mysql_query_digest` to reset baselines.

**MCP Tools:**
| Admin Query | MCP Tool |
|---|---|
| `stats_mysql_global` | `proxysql_status` |
| `mysql_servers` | `proxysql_servers` |
| `mysql_query_rules` | `proxysql_query_rules` |
| `stats_mysql_query_digest` | `proxysql_query_digest` |
| `stats_mysql_connection_pool` | `proxysql_connection_pool` |
| `mysql_users` | `proxysql_users` |
| `global_variables` | `proxysql_global_variables` |
| Runtime admin vars | `proxysql_runtime_status` |
| `stats_memory_metrics` | `proxysql_memory_stats` |
| `SHOW FULL PROCESSLIST` | `proxysql_process_list` |
| Raw admin commands | `proxysql_commands` |

### 3.8 Group Replication / InnoDB Cluster Support

ProxySQL natively supports InnoDB Cluster / Group Replication topology:

- Auto-detects Single-Primary / Multi-Primary topologies by monitoring `performance_schema`.
- Automatically shuns lagging nodes and reroutes traffic using `mysql_group_replication_hostgroups`.
- Provides auto-discovery of replicas and seamless failover.

### 3.9 ProxySQL Cluster

Multiple ProxySQL instances can form a cluster for peer-to-peer configuration synchronization (v1.4.2+):

- Automatically syncs `mysql_query_rules`, `mysql_servers`, `mysql_users`, etc. using pull-based checksums.
- **[ALWAYS]** use unique cluster credentials (`admin-cluster_username`).

### 3.10 Security

- **[ALWAYS]** restrict access to port 6032 (Admin) to management IPs only via network firewalls.
- **[ALWAYS]** enable SSL/TLS for all frontend and backend connections.
- **Firewall Whitelist** (v2.0.9+): Build rules in `DETECTING` mode, then switch to `PROTECTING` mode to block unwhitelisted queries.
- **[NEVER]** expose port 6032 to untrusted networks. Default credentials (`admin:admin`) MUST be changed immediately.

### 3.11 MCP Configuration

```bash
PROXYSQL_HOST=localhost
PROXYSQL_PORT=6032
PROXYSQL_USER=admin
PROXYSQL_PASSWORD=admin
```

### 3.12 Docker Deployment

- **Sidecar Pattern**: Run ProxySQL in the same pod as the application via `localhost:6033`. Provides lowest latency and isolated connection pools.
- **Centralized**: Shared connection pools across application replicas, simpler configuration management.
- **Challenge**: Kubernetes lacks native sidecar lifecycle management — custom controllers may be needed for clean shutdown sequencing.

### 3.13 Performance Tuning

- **Thread Tuning**: Increase `mysql-threads` (default: 4) based on available CPU cores for high concurrency.
- **Connection Tuning**: Adjust `mysql-connect_timeout_server` and `mysql-connection_max_age_ms` to prevent connection churn.
- **[ALWAYS]** use query digests to analyze workload patterns before blindly tuning variables.
- **[ALWAYS]** minimize complex regex rules to save CPU cycles.

---

## 4. Decision Matrix: Router vs ProxySQL

| Requirement | MySQL Router | ProxySQL |
|---|---|---|
| InnoDB Cluster native integration | ✅ Built-in (bootstrap) | ⚠️ Requires manual GR hostgroup config |
| Auto failover discovery | ✅ Metadata cache | ⚠️ Via `performance_schema` monitoring |
| Connection multiplexing | ⚠️ Basic (8.4+ sharing) | ✅ Full C10K multiplexing |
| Query routing rules | ❌ Not supported | ✅ Regex-based with hostgroups |
| Query caching | ❌ Not supported | ✅ Built-in TTL cache |
| Query rewriting | ❌ Not supported | ✅ Full rewriting engine |
| Firewall / query whitelist | ❌ Not supported | ✅ Whitelist mode (v2.0.9+) |
| Setup complexity | Low (single bootstrap) | Medium-High (admin SQL) |
| Official Oracle support | ✅ | ❌ (community) |

**Rule of Thumb:**
- **[USE Router]** for out-of-the-box HA routing with InnoDB Cluster where simplicity and official support matter.
- **[USE ProxySQL]** when advanced connection multiplexing, query routing, caching, or firewalling is required.
- **[USE Both]** in enterprise setups: Router for cluster-aware HA failover → ProxySQL in front for multiplexing and query optimization.

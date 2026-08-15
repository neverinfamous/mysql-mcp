---
name: proxysql
version: 1.0.0
tags:
  - "agent-skill"
triggers:
  - ProxySQL
  - proxysql
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
  Production standards for ProxySQL, a high-performance MySQL proxy providing connection multiplexing, query routing, caching, and firewalling.
  Use when configuring, troubleshooting, or making architectural decisions about multiplexing, query caching, query routing rules, or firewall lists.
  Triggers on: "ProxySQL", "proxysql", "connection multiplexing", "query routing".
  Do NOT trigger for basic MySQL queries or schema design (use `mysql` skill).
references:
  - mysql
  - mysql-mcp
---

# ProxySQL Production Standards

ProxySQL is a high-performance MySQL proxy providing connection multiplexing, query routing, caching, and firewalling.

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

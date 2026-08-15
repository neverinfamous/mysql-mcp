---
name: mysql-router
version: 1.0.0
tags:
  - "agent-skill"
triggers:
  - MySQL Router
  - mysqlrouter
  - mysqlrouter.conf
  - InnoDB Cluster
exclude:
  - "generic MySQL queries without ecosystem context"
  - "ORM-managed migrations"
  - Postgres
  - PostgreSQL
  - SQLite
description: |
  Production standards for MySQL Router, the lightweight middleware for transparent routing between applications and MySQL InnoDB Cluster servers.
  Use when configuring, troubleshooting, or making architectural decisions about HA routing, connection pooling, or cluster integration.
  Triggers on: "MySQL Router", "mysqlrouter", "InnoDB Cluster".
  Do NOT trigger for basic MySQL queries or schema design (use `mysql` skill).
references:
  - mysql
  - mysql-mcp
---

# MySQL Router Production Standards

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

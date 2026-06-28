# MySQL Ecosystem Setup for mysql-mcp Testing

_Created: December 16, 2025_
_Updated: March 6, 2026_

This document summarizes the installation and configuration of MySQL Router, ProxySQL, MySQL Shell, and **InnoDB Cluster** for testing mysql-mcp's ecosystem tools.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Docker Network: innodb-cluster-net                        │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ mysql-node1  │  │ mysql-node2  │  │ mysql-node3  │                       │
│  │   PRIMARY    │  │  SECONDARY   │  │  SECONDARY   │                       │
│  │  Port: 3307  │  │  Port: 3308  │  │  Port: 3309  │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                 │                 │                                │
│         └────────────┬────┴─────────────────┘                                │
│                      ▼                                                       │
│            ┌──────────────────┐           ┌──────────────┐                   │
│            │   MySQL Router   │           │   ProxySQL   │                   │
│            │ RW: 6446 RO:6447 │           │ Admin: 6032  │                   │
│            │ REST API: 8443   │           │ Data:  6033  │                   │
│            └──────────────────┘           └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Status

| Component          | Container         | Status                        | Version |
| ------------------ | ----------------- | ----------------------------- | ------- |
| **InnoDB Cluster** | `mysql-node1/2/3` | ✅ Running (3 nodes)          | 8.0.45  |
| **MySQL Router**   | `mysql-router`    | ✅ Persistent (Docker volume) | 9.6.0   |
| **ProxySQL**       | `proxysql`        | ✅ Running                    | 3.0.x   |
| **MySQL Shell**    | Native install    | ✅ Installed                  | 9.5.0   |

---

## InnoDB Cluster

### Cluster Status

| Property               | Value                                  |
| ---------------------- | -------------------------------------- |
| Cluster Name           | `testCluster`                          |
| Status                 | **OK** (can tolerate 1 failure)        |
| Topology               | Single-Primary                         |
| Group Replication UUID | `aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee` |

### Cluster Nodes

| Node          | Role      | Mode | Host Port        |
| ------------- | --------- | ---- | ---------------- |
| `mysql-node1` | PRIMARY   | R/W  | `localhost:3307` |
| `mysql-node2` | SECONDARY | R/O  | `localhost:3308` |
| `mysql-node3` | SECONDARY | R/O  | `localhost:3309` |

### Cluster Credentials

| Property               | Value           |
| ---------------------- | --------------- |
| Cluster Admin User     | `cluster_admin` |
| Cluster Admin Password | `cluster_admin` |
| Root Password          | `root`          |

### Starting the Cluster After Reboot

With `group_replication_start_on_boot=ON` (set in `innodb-cluster.yml`), the cluster **auto-recovers** from partial outages (single node restart, Docker upgrade). After a **full outage** (machine reboot where all 3 nodes stop simultaneously), Group Replication may fail to auto-start because no node can bootstrap the group. Use the convenience script:

```powershell
# Quick reboot (uses defaults: root:root@localhost:3307, testCluster)
.\scripts\reboot-cluster.ps1
```

**Manual steps (if script is unavailable):**

```powershell
# 1. Start all cluster containers
docker start mysql-node1 mysql-node2 mysql-node3

# 2. Wait for containers to be healthy
docker ps --filter "name=mysql-node" --format "{{.Names}}: {{.Status}}"

# 3. Reboot the cluster using MySQL Shell
& 'C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe' --uri root:root@localhost:3307 --js -e "dba.rebootClusterFromCompleteOutage('testCluster', {force: true})"

# 4. Rejoin secondaries if they show as MISSING
docker exec mysql-node1 mysqlsh --uri cluster_admin:cluster_admin@mysql-node1:3306 --js -e "var c = dba.getCluster(); c.rejoinInstance('cluster_admin:cluster_admin@mysql-node2:3306');"
docker exec mysql-node1 mysqlsh --uri cluster_admin:cluster_admin@mysql-node1:3306 --js -e "var c = dba.getCluster(); c.rejoinInstance('cluster_admin:cluster_admin@mysql-node3:3306');"

# 5. Router auto-reconnects to metadata cache (no restart needed)
# Verify: curl.exe -s -k -u rest_api:router_api https://localhost:8443/api/20190715/router/status
```

> **Note:** The Router uses a persistent Docker volume (`mysql-router-data`) with pre-bootstrapped config. It bypasses the image entrypoint and runs `mysqlrouter` directly, so it never re-bootstraps. It auto-reconnects to the metadata cache once the cluster is online.

### Recovery After WSL/Docker Volume Rebuild

If Docker volumes were recreated (e.g., WSL reinstall, `docker volume prune`), the `.cnf` files mounted from Windows appear as world-writable (`777`) inside containers and are **ignored by MySQL**. In this case, `rebootClusterFromCompleteOutage` may only bring the primary online while secondaries remain OFFLINE.

**Symptoms:**

- `rebootClusterFromCompleteOutage` succeeds but only node1 comes ONLINE
- `rejoinInstance` fails with "Group Replication failed"
- `START GROUP_REPLICATION` fails with ERROR 3092: "The server is not configured to be a member of a group"

**Fix — remove and re-add secondaries with clone recovery (run from inside node1):**

```powershell
# 1. Remove stale secondaries
docker exec mysql-node1 mysqlsh --uri cluster_admin:cluster_admin@mysql-node1:3306 --js -e "var c = dba.getCluster(); c.removeInstance('cluster_admin:cluster_admin@mysql-node2:3306', {force: true});"
docker exec mysql-node1 mysqlsh --uri cluster_admin:cluster_admin@mysql-node1:3306 --js -e "var c = dba.getCluster(); c.removeInstance('cluster_admin:cluster_admin@mysql-node3:3306', {force: true});"

# 2. Re-add with clone (container stops during clone restart — start it manually)
docker exec mysql-node1 mysqlsh --uri cluster_admin:cluster_admin@mysql-node1:3306 --js -e "var c = dba.getCluster(); c.addInstance('cluster_admin:cluster_admin@mysql-node2:3306', {recoveryMethod: 'clone'});"
# When "Waiting for server restart..." hangs, check and start the container:
docker start mysql-node2
# Wait for addInstance to complete, then repeat for node3:
docker exec mysql-node1 mysqlsh --uri cluster_admin:cluster_admin@mysql-node1:3306 --js -e "var c = dba.getCluster(); c.addInstance('cluster_admin:cluster_admin@mysql-node3:3306', {recoveryMethod: 'clone'});"
docker start mysql-node3

# 3. Restart Router
docker restart mysql-router
```

> **Why this works:** `addInstance` uses `SET PERSIST` to write GR configuration to `mysqld-auto.cnf` in the data volume, bypassing the ignored `.cnf` files. Subsequent reboots will work with the normal reboot procedure above.

---

## Connection Details

### MySQL (via InnoDB Cluster)

| Property            | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| Primary (R/W)       | `localhost:3307` or via Router `localhost:6446`                   |
| Read Replicas (R/O) | `localhost:3308`, `localhost:3309` or via Router `localhost:6447` |
| User                | `root` or `cluster_admin`                                         |
| Password            | `root` or `cluster_admin`                                         |

### ProxySQL

| Property       | Value           |
| -------------- | --------------- |
| Admin Host     | `localhost`     |
| Admin Port     | `6032`          |
| Admin User     | `radmin`        |
| Admin Password | `radmin`        |
| Data Port      | `6033`          |
| Data User      | `root` / `root` |

### MySQL Router (Cluster Mode)

| Property             | Value                    |
| -------------------- | ------------------------ |
| REST API URL         | `https://localhost:8443` |
| API Version          | `/api/20190715`          |
| REST API User        | `rest_api`               |
| REST API Password    | `router_api`             |
| Metadata Cache Name  | `bootstrap`              |
| Connection Pool Name | `main`                   |
| RW Routing Port      | `6446` (→ PRIMARY)       |
| RO Routing Port      | `6447` (→ SECONDARY)     |
| X Protocol RW        | `6448`                   |
| X Protocol RO        | `6449`                   |

> **Note:** REST API users are stored in a `rest_users` file at `/tmp/mysqlrouter/data/rest_users` inside the container, created via `mysqlrouter_passwd`. The `[rest_connection_pool]` plugin and `connection_sharing=1` on routes are required for `pool_status` to work.

### MySQL Shell

| Property | Value                                                    |
| -------- | -------------------------------------------------------- |
| Path     | `C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe` |
| Version  | 9.5.0                                                    |

---

## MCP Configuration Examples

### Option 1: Cluster Tools Only (10 tools)

Use this configuration to test **Group Replication and InnoDB Cluster monitoring tools**:

```json
{
  "mcpServers": {
    "mysql-cluster": {
      "command": "node",
      "args": [
        "C:/Users/chris/Desktop/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--tool-filter",
        "cluster"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3307",
        "MYSQL_USER": "cluster_admin",
        "MYSQL_PASSWORD": "cluster_admin",
        "MYSQL_DATABASE": "testdb"
      }
    }
  }
}
```

> **Critical:**
>
> - Must connect to a **cluster node** (port 3307, 3308, or 3309) — NOT standalone MySQL on port 3306
> - InnoDB Cluster must be running with Group Replication enabled
> - Use `cluster_admin` or `root` user with appropriate privileges

### Option 2: Full Ecosystem (31 tools)

Use this configuration to test **Router, ProxySQL, Shell, and Cluster tools**:

```json
{
  "mcpServers": {
    "mysql-ecosystem": {
      "command": "node",
      "args": [
        "C:/Users/chris/Desktop/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--tool-filter",
        "ecosystem"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3307",
        "MYSQL_USER": "cluster_admin",
        "MYSQL_PASSWORD": "cluster_admin",
        "MYSQL_DATABASE": "testdb",

        "PROXYSQL_HOST": "localhost",
        "PROXYSQL_PORT": "6032",
        "PROXYSQL_USER": "radmin",
        "PROXYSQL_PASSWORD": "radmin",

        "MYSQL_ROUTER_URL": "https://localhost:8443",
        "MYSQL_ROUTER_USER": "rest_api",
        "MYSQL_ROUTER_PASSWORD": "router_api",
        "MYSQL_ROUTER_INSECURE": "true",

        "MYSQLSH_PATH": "C:\\Program Files\\MySQL\\MySQL Shell 9.5\\bin\\mysqlsh.exe"
      }
    }
  }
}
```

> **Important:**
>
> - Router REST API uses HTTPS with self-signed certificate. Set `MYSQL_ROUTER_INSECURE=true` to skip certificate verification.
> - Router REST API uses file-based authentication (`rest_users` file created via `mysqlrouter_passwd`)
> - Connect to a cluster node (3307) to access cluster metadata for all tools

---

## Tool Filtering Options

### Cluster Tools Only (10 tools)

```json
"--tool-filter", "cluster"
```

Enables: 10 Group Replication and InnoDB Cluster monitoring tools

### Ecosystem Tools (31 tools)

```json
"--tool-filter", "ecosystem"
```

Enables:

- 9 Router tools (`mysql_router_*`)
- 12 ProxySQL tools (`proxysql_*`)
- 10 Shell tools (`mysqlsh_*`)

### Combined: Cluster + Ecosystem (41 tools)

```json
"--tool-filter", "+cluster,+ecosystem"
```

Enables all cluster, router, proxysql, and shell tools

### With Core Tools

```json
"--tool-filter", "starter,+cluster,+ecosystem"
```

Enables core CRUD operations plus all ecosystem tools

---

## Verification Commands

### Test ProxySQL

```powershell
# Admin interface
curl.exe -s http://localhost:6032/

# Data connection (via Docker)
docker exec mysql-final mysql -hproxysql -P6033 -uroot -proot -e "SELECT 1"
```

### Test MySQL Router

```powershell
# REST API status (HTTPS with self-signed cert)
curl.exe -s -k -u rest_api:router_api https://localhost:8443/api/20190715/router/status

# List routes
curl.exe -s -k -u rest_api:router_api https://localhost:8443/api/20190715/routes

# Metadata cache status
curl.exe -s -k -u rest_api:router_api https://localhost:8443/api/20190715/metadata/bootstrap/status

# Connection pool status
curl.exe -s -k -u rest_api:router_api https://localhost:8443/api/20190715/connection_pool/main/status

# Routing connection (via cluster)
docker exec mysql-node1 mysql -hmysql-router -P6446 -uroot -proot -e "SELECT 1"
```

### Test MySQL Shell

```powershell
& "C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe" --version
```

---

## Configuration Files

Located in `C:\Users\chris\Desktop\mysql-mcp`:

| File                       | Purpose                                     |
| -------------------------- | ------------------------------------------- |
| `innodb-cluster.yml`       | Docker Compose for 3-node InnoDB Cluster    |
| `cluster-config/node1.cnf` | MySQL config for node 1 (Group Replication) |
| `cluster-config/node2.cnf` | MySQL config for node 2 (Group Replication) |
| `cluster-config/node3.cnf` | MySQL config for node 3 (Group Replication) |
| `router-cluster.conf`      | Router config with all REST plugins enabled |
| `router-data/`             | Router data folder (certs, keyring, state)  |
| `proxysql.cnf`             | ProxySQL configuration with MySQL backend   |

---

## Container Management

### InnoDB Cluster

```powershell
# Start cluster
docker compose -f innodb-cluster.yml up -d

# Stop cluster
docker compose -f innodb-cluster.yml down

# View cluster status (via MySQL Shell)
& "C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe" --uri cluster_admin:cluster_admin@localhost:3307 --js -e "print(dba.getCluster().status())"

# Restart specific node
docker restart mysql-node1

# Reboot cluster from complete outage (after all nodes stopped)
& "C:\Program Files\MySQL\MySQL Shell 9.5\bin\mysqlsh.exe" --uri cluster_admin:cluster_admin@localhost:3307 --js -e "dba.rebootClusterFromCompleteOutage('testCluster', {force: true})"
```

### MySQL Router (Persistent)

The Router uses a **Docker volume** (`mysql-router-data`) containing pre-bootstrapped config, keyring, certs, and state. The entrypoint is overridden to skip bootstrap entirely.

```powershell
# Create Router container (one-time, after bootstrap)
docker run -d --name mysql-router --hostname mysql-router `
  --network innodb-cluster-net `
  --restart unless-stopped `
  -p 8443:8443 -p 6446:6446 -p 6447:6447 `
  -p 6448:6448 -p 6449:6449 -p 6450:6450 `
  -v mysql-router-data:/tmp/mysqlrouter `
  --entrypoint mysqlrouter `
  container-registry.oracle.com/mysql/community-router `
  -c /tmp/mysqlrouter/mysqlrouter.conf

# Start/Stop/Restart
docker start mysql-router
docker stop mysql-router
docker restart mysql-router

# View logs
docker logs mysql-router --tail 20
```

> **Why this persists across restarts/upgrades:** The pre-bootstrapped config lives in a Docker volume, not inside the container filesystem. The `--entrypoint mysqlrouter` bypasses the image's `/run.sh` script (which tries to re-bootstrap). The router reads its existing config, keyring, and state.json on every start.

### Re-Bootstrap Router (After Docker Volume Prune)

If the `mysql-router-data` volume is lost (e.g., `docker volume prune`), re-bootstrap:

```powershell
# 1. Ensure cluster is online first
# 2. Create fresh volume
docker volume create mysql-router-data

# 3. Fix ownership (Router runs as uid 999)
docker run --rm --user root -v mysql-router-data:/tmp/mysqlrouter `
  --entrypoint /bin/bash container-registry.oracle.com/mysql/community-router `
  -c "chown -R 999:999 /tmp/mysqlrouter"

# 4. Bootstrap into the volume
docker run --rm --network innodb-cluster-net `
  -v mysql-router-data:/tmp/mysqlrouter `
  --entrypoint /bin/bash container-registry.oracle.com/mysql/community-router `
  -c "mysqlrouter --bootstrap root:root@mysql-node1:3306 --directory /tmp/mysqlrouter --force --conf-set-option http_server.port=8443 --conf-set-option rest_connection_pool.require_realm=default_auth_realm --conf-set-option routing:bootstrap_rw.connection_sharing=1"

# 5. Create REST API user
docker run --rm -v mysql-router-data:/tmp/mysqlrouter `
  --entrypoint /bin/bash container-registry.oracle.com/mysql/community-router `
  -c "echo 'router_api' | /usr/bin/mysqlrouter_passwd set /tmp/mysqlrouter/data/rest_users rest_api"

# 6. Switch REST auth from metadata_cache to file-based
docker run --rm -v mysql-router-data:/tmp/mysqlrouter `
  --entrypoint /bin/bash container-registry.oracle.com/mysql/community-router `
  -c "sed -i 's|backend=metadata_cache|backend=file\nfilename=/tmp/mysqlrouter/data/rest_users|' /tmp/mysqlrouter/mysqlrouter.conf"

# 7. Create persistent Router container (see above)
```

### Other Containers

```powershell
# Start ProxySQL
docker start proxysql

# View logs
docker logs proxysql
```

### Infrastructure UI Tools (Debugging & Management)

For visual management and real-time log debugging of the MySQL cluster, the following UI tools are recommended (provided via `infra-tools.yml`):

- **Adminer** (Web-based Database Manager): Access at `http://localhost:8081` to execute queries against `mysql-node1` (port 3307), Router (port 6446/6447), or ProxySQL (port 6033).
- **Dozzle** (Real-time Container Logs): Access at `http://localhost:8080` to instantly view, search, and stream logs for the cluster nodes, router, and proxysql without using the CLI.

---

## mysql-mcp Tools Available

### Cluster Tools (10)

- `mysql_gr_status` - Group Replication status
- `mysql_gr_members` - List GR members
- `mysql_gr_primary` - Get current primary
- `mysql_gr_transactions` - Transaction status
- `mysql_gr_flow_control` - Flow control info
- `mysql_cluster_status` - InnoDB Cluster status
- `mysql_cluster_instances` - List cluster instances
- `mysql_cluster_topology` - Cluster topology
- `mysql_cluster_router_status` - Router registrations
- `mysql_cluster_switchover` - Initiate switchover

### Router Tools (9)

> **Note:** Router REST API uses file-based authentication (`rest_users` file). The `[rest_connection_pool]` plugin and `connection_sharing=1` are required for `pool_status`.

- `mysql_router_status` - Process status and version
- `mysql_router_routes` - List configured routes (e.g., `bootstrap_rw`, `bootstrap_ro`)
- `mysql_router_route_status` - Route status (active connections, total connections)
- `mysql_router_route_health` - Route health check (`isAlive: true/false`)
- `mysql_router_route_connections` - Active connections on a route
- `mysql_router_route_destinations` - Backend destinations (e.g., `mysql-node1:3306`)
- `mysql_router_route_blocked_hosts` - Blocked IPs due to failed connection attempts
- `mysql_router_metadata_status` - Cluster metadata cache status (use `metadataName: "bootstrap"`)
- `mysql_router_pool_status` - Connection pool stats (use `poolName: "main"`, requires `[rest_connection_pool]` + `connection_sharing=1`)

### ProxySQL Tools (12)

- `proxysql_status` - Version and runtime stats
- `proxysql_servers` - Backend MySQL servers
- `proxysql_hostgroups` - Hostgroup configurations
- `proxysql_query_rules` - Query routing rules
- `proxysql_query_digest` - Query digest stats
- `proxysql_connection_pool` - Pool statistics
- `proxysql_users` - Configured users
- `proxysql_global_variables` - Global variables
- `proxysql_runtime_status` - Runtime config
- `proxysql_memory_stats` - Memory usage
- `proxysql_commands` - Admin commands (LOAD/SAVE)
- `proxysql_process_list` - Active sessions

### Shell Tools (10)

- `mysqlsh_version` - Shell version and status
- `mysqlsh_check_upgrade` - Upgrade compatibility
- `mysqlsh_export_table` - Export to CSV/TSV/JSON
- `mysqlsh_import_table` - Parallel table import
- `mysqlsh_import_json` - Import JSON documents
- `mysqlsh_dump_instance` - Full instance dump
- `mysqlsh_dump_schemas` - Schema dump
- `mysqlsh_dump_tables` - Table dump
- `mysqlsh_load_dump` - Load dump
- `mysqlsh_run_script` - Execute JS/Python/SQL

---

## Troubleshooting

### Router Tools Return "fetch failed" or 401 Unauthorized

**Cause:** Router REST API `rest_users` file is missing or corrupted (e.g., CRLF line endings from Windows `docker cp`).

**Fix:**

```powershell
# Regenerate rest_users file inside the container
docker exec mysql-router sh -c "echo 'router_api' | /usr/bin/mysqlrouter_passwd set /tmp/mysqlrouter/data/rest_users rest_api"

# If copied from Windows, fix CRLF line endings
docker exec mysql-router sh -c "tr -d '\r' < /tmp/mysqlrouter/data/rest_users > /tmp/fix && mv /tmp/fix /tmp/mysqlrouter/data/rest_users"

# Send SIGHUP to reload auth file
docker kill --signal=SIGHUP mysql-router
```

### Router pool_status Returns 404

**Cause:** Missing `[rest_connection_pool]` plugin or `connection_sharing` not enabled on routes.

**Fix:** Recreate the Router container with the additional bootstrap options:

```
--conf-set-option rest_connection_pool.require_realm=default_auth_realm
--conf-set-option routing:bootstrap_rw.connection_sharing=1
```

### Router Logs Show "not an online GR member"

**Cause:** Cluster nodes are running but Group Replication is not active.

**Fix:** Reboot cluster from complete outage (see above).

### TLS Certificate Errors

**Cause:** Router uses self-signed certificates by default.

**Fix:** Ensure `MYSQL_ROUTER_INSECURE=true` is set in your MCP configuration.

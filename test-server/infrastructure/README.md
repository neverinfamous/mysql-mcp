# Unified Database Ecosystem

**🤖 AGENT OPTIMIZED README**

_Updated: July 2026_

This directory contains the ultimate, unified `docker-compose.yml` for the entire database, routing, and monitoring stack used in this project. It fully replaces all previously fragmented setups.

## 1. Quick Start

To spin up the entire ecosystem, simply run:

```powershell
cd C:\Users\chris\Desktop\adamic\docs\unified-database-ecosystem
docker compose up -d
```

Once the containers are running, you must initialize the MySQL InnoDB cluster if this is a fresh setup:

```powershell
node scripts/create-cluster.mjs
```

## 2. Container Registry & Ports

| Component | Container Name | Exposes / Ports | Image |
|---|---|---|---|
| **MySQL Node 1 (Primary)** | `mysql-node1` | `3307` | `mysql:lts` |
| **MySQL Node 2 (Replica)** | `mysql-node2` | `3308` | `mysql:lts` |
| **MySQL Node 3 (Replica)** | `mysql-node3` | `3309` | `mysql:lts` |
| **MySQL Router** | `mysql-router` | `6446` (RW), `6447` (RO), `8443` | `container-registry.oracle.com/mysql/community-router:9.1.0` |
| **ProxySQL** | `proxysql` | `6032` (Admin), `6033` (Data) | `proxysql/proxysql:2.6.3` |
| **PostgreSQL** | `postgres-server` | `5432` | `postgres-hypopg:18` (Custom Build) |
| **MongoDB** | `mongo-server` | `27017` | `mongo:8.0.0` |
| **Redis** | `redis-server` | `6379` | `redis:7.4.0` |
| **Dozzle (Log Viewer)** | `dozzle` | `http://localhost:8080/` | `amir20/dozzle:v10.6.9` |
| **Adminer (DB UI)** | `adminer` | `http://localhost:8081/` (System: `MySQL`, Server: `mysql-node1`, User: `root`, Pass: `root`) | `adminer:4.8.1` |
| **Prometheus** | `prometheus` | `9090` | `prom/prometheus:v2.54.1` |
| **Grafana** | `grafana` | `3001` | `grafana/grafana:11.2.0` |
| **Datadog Agent** | `datadog-unified`| N/A | `gcr.io/datadoghq/agent:7` |

- **Datadog Dashboards**: [Custom Dashboard](https://app.datadoghq.com/dashboard/iae-57y-br7) | [MySQL Overview](https://app.datadoghq.com/dash/integration/12/mysql---overview)

## 3. Automation Scripts

All scripts are located in the `scripts/` directory and can be executed natively with `node`.

- `recreate-ecosystem.mjs`: Automates the entire teardown, startup, and InnoDB cluster bootstrapping process.
- `create-cluster.mjs`: Initializes Group Replication. Fully idempotent with deep retry logic (up to 60 retries) and connection-drop handling during the `clone` process.
- `reboot-cluster.mjs`: Use this if all containers go offline at once and auto-bootstrap fails.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`.

## 4. Disaster Recovery & Volumes

All databases use persistent volumes (`mysql-node1-data-v4`, `postgres-data-v2`, `mongo-data-v2`).

To perform a complete factory wipe of the entire data tier and automatically bootstrap the cluster:

```powershell
node scripts/recreate-ecosystem.mjs
```

## 5. Configurations

All config files are mounted directly from the `config/` directory:
- `config/proxysql/`: `proxysql.cnf`
- `config/prometheus/`: `prometheus.yml`
- `config/grafana/`: Dashboards and provisioning files.
- `config/datadog-integration-configs/`: Contains the integration overrides for Postgres, Mongo, MySQL, and Redis.

## 6. Troubleshooting: WSL Background Termination
If you notice that `mysql-router` is stuck in a crash loop (the green checkmark disappears repeatedly in Docker Desktop) or containers keep restarting:
1. **The Cause**: Windows Subsystem for Linux (WSL) will automatically suspend and terminate background distributions if there is no active Windows session holding it open. This kills the Docker daemon mid-flight and corrupts the InnoDB cluster state.
2. **The Fix**: Open PowerShell and run the keepalive registration script:
   `pwsh.exe -File C:\Users\chris\Desktop\adamic\docs\unified-database-ecosystem\scripts\register-wsl-keepalive.ps1`
3. **Recovery**: After ensuring the `WSL-KeepAlive` task is "Running" in Task Scheduler, you MUST fully rebuild the corrupted cluster by running `node scripts/recreate-ecosystem.mjs` again.

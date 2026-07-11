# MySQL Test Infrastructure

_Updated: July 2026_

This directory contains the `docker-compose.yml` for the MySQL-focused test infrastructure used by mysql-mcp integration tests. It is a lightweight subset of the full Adamic unified database ecosystem, automatically synchronized via the `sync-test-infra` workflow.

## 1. Quick Start

To spin up the test infrastructure, run:

```powershell
cd C:\Users\chris\Desktop\mysql-mcp\test-server\infrastructure
docker compose up -d
```

Once the containers are running, you must initialize the MySQL InnoDB cluster if this is a fresh setup:

```powershell
node scripts/create-cluster.mjs
```

Or use the all-in-one script that tears down, rebuilds, and bootstraps:

```powershell
node scripts/recreate-test-ecosystem.mjs
```

## 2. Container Registry & Ports

| Component | Container Name | Exposes / Ports | Image |
|---|---|---|---|
| **MySQL Node 1 (Primary)** | `mysql-node1` | `3307` | `mysql:9.1.0` |
| **MySQL Node 2 (Replica)** | `mysql-node2` | `3308` | `mysql:9.1.0` |
| **MySQL Node 3 (Replica)** | `mysql-node3` | `3309` | `mysql:9.1.0` |
| **MySQL Router** | `mysql-router` | `6446` (RW), `6447` (RO), `8443` | `container-registry.oracle.com/mysql/community-router:9.1.0` |
| **ProxySQL** | `proxysql` | `6032` (Admin), `6033` (Data) | `proxysql/proxysql:2.6.3` |
| **Redis** | `redis-server` | `6379` | `redis:7.4.0` |
| **Dozzle (Log Viewer)** | `dozzle` | `http://localhost:8080/` | `amir20/dozzle:v10.6.9` |
| **Adminer (DB UI)** | `adminer` | `http://localhost:8081/` (System: `MySQL`, Server: `mysql-node1`, User: `root`, Pass: `root`) | `adminer:4.8.1` |
| **Prometheus** | `prometheus` | `9090` | `prom/prometheus:v2.54.1` |
| **Grafana** | `grafana` | `3001` | `grafana/grafana:11.2.0` |
| **Datadog Agent** | `datadog-unified`| `8125/udp` (StatsD), `8126` (APM) | `gcr.io/datadoghq/agent:7` |

- **Datadog Dashboards**: [Custom Dashboard](https://app.datadoghq.com/dashboard/iae-57y-br7) | [MySQL Overview](https://app.datadoghq.com/dash/integration/12/mysql---overview) | [Host Map](https://app.datadoghq.com/infrastructure/map) (look for `adamic-wsl2`)

## 3. Datadog Agent

The `datadog-unified` container runs with `pid: host` and eBPF system-probe to provide full observability:

- **Host system metrics**: CPU, memory, disk, I/O, load, network, NTP, file handles, uptime
- **Container monitoring**: All Docker container metrics via socket + Autodiscovery
- **Database integrations**: MySQL (InnoDB Cluster), Redis, ProxySQL
- **Process collection**: Live Processes with host PID namespace
- **Network Performance Monitoring**: eBPF-based TCP/UDP connection tracking
- **APM tracing**: Enabled for application containers (set `DD_AGENT_HOST=datadog-unified`)

Hostname: `adamic-wsl2`

## 4. Automation Scripts

All scripts are located in the `scripts/` directory and can be executed natively with `node`.

- `recreate-test-ecosystem.mjs`: Automates the entire teardown, orphaned container cleanup, startup, and InnoDB cluster bootstrapping process.
- `create-cluster.mjs`: Initializes Group Replication. Fully idempotent with deep retry logic (up to 60 retries), connection-drop handling during the `clone` process, stabilization sleeps, and autonomous reboot healing.
- `check-status.mjs`: Quickly checks the health of all containers and validates the InnoDB Cluster quorum natively using the MySQL client.
- `reboot-cluster.mjs`: Use this if all containers go offline at once and auto-bootstrap fails.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`.

## 5. Disaster Recovery & Volumes

MySQL uses persistent volumes (`mysql-node1-data-v4`, `mysql-node2-data-v4`, `mysql-node3-data-v4`).

To perform a complete factory wipe and automatically bootstrap the cluster:

```powershell
node scripts/recreate-test-ecosystem.mjs
```

## 6. Configurations

All config files are mounted directly from the `config/` directory:
- `config/proxysql/`: `proxysql.cnf`
- `config/prometheus/`: `prometheus.yml`
- `config/grafana/`: Dashboards and provisioning files.
- `config/datadog-integration-configs/`: Integration configs for MySQL, Redis, and ProxySQL checks, plus host system check defaults (cpu, memory, disk, io, load, network, ntp, file_handle, uptime).

## 7. Troubleshooting: WSL Background Termination
If you notice that `mysql-router` is stuck in a crash loop or containers keep restarting:
1. **The Cause**: Windows Subsystem for Linux (WSL) will automatically suspend and terminate background distributions if there is no active Windows session holding it open. This kills the Docker daemon mid-flight and corrupts the InnoDB cluster state.
2. **The Fix**: Open PowerShell and run the keepalive registration script:
   `pwsh.exe -File C:\Users\chris\Desktop\adamic\docs\unified-database-ecosystem\scripts\register-wsl-keepalive.ps1`
3. **Recovery**: After ensuring the `WSL-KeepAlive` task is "Running" in Task Scheduler, you MUST fully rebuild the corrupted cluster by running `node scripts/recreate-test-ecosystem.mjs` again.

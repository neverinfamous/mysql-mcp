# Unified Database Ecosystem

_Updated: July 2026_

This directory contains the unified `docker-compose.yml` for the entire database, routing, and monitoring stack used in this project. It fully replaces all previously fragmented setups.

## 1. Quick Start

To spin up the entire ecosystem from scratch (teardown + start + cluster bootstrap + seed):

```powershell
cd C:\Users\chris\Desktop\mysql-mcp\test-server\infrastructure
node scripts/recreate-ecosystem.mjs
```

If the cluster already exists and you just need to restart containers:

```powershell
docker compose up -d
```

## 2. Container Registry & Ports

| Component | Container Name | Exposes / Ports | Image |
|---|---|---|---|
| **MySQL Node 1 (Primary)** | `mysql-node1` | `3307` | `mysql:9.7.1` |
| **MySQL Node 2 (Replica)** | `mysql-node2` | `3308` | `mysql:9.7.1` |
| **MySQL Node 3 (Replica)** | `mysql-node3` | `3309` | `mysql:9.7.1` |
| **MySQL Async Replica (R/O)** | `mysql-async-replica` | `3310` | `mysql:9.7.1` |
| **MySQL Router** | `mysql-router` | `6446` (RW), `6447` (RO), `6448` (XRO), `8443` | `container-registry.oracle.com/mysql/community-router:9.7.1` |
| **ProxySQL** | `proxysql` | `6032` (Admin), `6033` (Data) | `proxysql/proxysql:3.0.10` |

| **Redis** | `redis-server` | `6379` | `redis:8.10.0` |
| **Dozzle (Log Viewer)** | `dozzle` | `http://localhost:8080/` | `amir20/dozzle` |
| **Adminer (DB UI)** | `adminer` | `http://localhost:8081/` (System: `MySQL`, Server: `mysql-node1`, User: `root`, Pass: `root`) | `adminer:5.5.0` |
| **Prometheus** | `prometheus` | `9090` | `prom/prometheus:v3.13.2` |
| **MySQL MCP Exporter** | `mysql-mcp-exporter` | `3000` | `local build (../../../mysql-mcp)` |
| **Loki** | `loki` | `3100` | `grafana/loki:3.7.6` |
| **Grafana Alloy** | `alloy` | `12345` (internal HTTP) | `grafana/alloy:v1.18.1` |
| **Grafana** | `grafana` | `3001` | `grafana/grafana:13.1.3` |
| **Datadog Agent** | `datadog-unified`| `(network-internal only)` | `gcr.io/datadoghq/agent:7.82.1` |

> **Version Pinning:** All images use explicit version tags defined in [`docker-compose.yml`](docker-compose.yml). See that file for current versions.
> **Resilience:** All containers are configured with `restart: unless-stopped` to gracefully survive host laptop reboots without manual intervention.

- **Datadog Dashboards**: [AI Efficiency](https://app.datadoghq.com/dashboard/q48-mq9-3i7) | [Token & Tool Metrics](https://app.datadoghq.com/dashboard/qwe-2un-us8) | [MySQL](https://app.datadoghq.com/dashboard/4w2-tdx-wf7) | [Redis](https://app.datadoghq.com/dashboard/khx-zry-d49) | [Host Map](https://app.datadoghq.com/infrastructure/map) (look for `adamic-wsl2`)
  *(Note: Backups of custom Datadog dashboards like AI Efficiency (tracking `mysql-mcp` cache, connection pools, and error rates) and Token & Tool Metrics (tracking `MySQL-MCP Audit Log`) are stored as JSON files in the `config/` directory. When syncing with `pup`, some fields like `anomaly_detection` and `legend` are stripped from list streams).*
- **Grafana Dashboards**: Access the **MySQL-MCP Logs (Loki)** dashboard via Grafana at `http://localhost:3001` to view `mcp-audit.jsonl` and `agent-issues.jsonl` logs aggregated by **Grafana Alloy** (replaces EOL Promtail).

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

- `recreate-ecosystem.mjs`: Single self-contained script that automates the entire lifecycle: dynamic container discovery, orphaned container cleanup, teardown, startup, InnoDB Cluster bootstrap (with retry/healing), and database seeding.
- `check-status.mjs`: Dynamically discovers containers from `docker-compose.yml` and validates their health, plus checks the InnoDB Cluster quorum and identifies primary read-only locks.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`. Catches `super_read_only` locks and aborts.
- `heal-primary.mjs`: Un-sticks the primary node from a `super_read_only` lock by cycling the cluster primary election. Run this if `reset-database.mjs` fails due to a read-only lock.

## 5. Disaster Recovery & Volumes

All databases use persistent volumes (`mysql-node1-data-v4`, `mysql-node2-data-v4`, `mysql-node3-data-v4`).

**Auto-Healing Host Crashes**: The InnoDB cluster will not naturally reboot after a hard host crash (e.g. power loss or Windows/Docker crash) to prevent split-brain. However, a lightweight `cluster-healer` sidecar container runs continuously to detect total cluster outages and automatically executes `dba.rebootClusterFromCompleteOutage('mcpCluster')` and `STOP/START GROUP_REPLICATION` via `mysqlsh` to rebuild the cluster quorum. You do not need to intervene.

To perform a complete factory wipe of the entire data tier and automatically bootstrap the cluster:

```powershell
node scripts/recreate-ecosystem.mjs
```

## 6. Configurations

All config files are mounted directly from the `config/` directory:
- `config/mysql/`: Contains `init.sql` which bootstraps initial users and dynamically installs the `validate_password` component to support MCP security tool testing.
- `config/proxysql/`: `proxysql.cnf`
- `config/prometheus/`: `prometheus.yml`
- `config/grafana/`: Dashboards and provisioning files.
- `config/datadog-integration-configs/`: Legacy file-based integration configs for database checks (All databases now primarily use Docker Autodiscovery labels in `docker-compose.yml`) plus host system check defaults (cpu, memory, disk, io, load, network, ntp, file_handle, uptime).
- `config/mysql-router/`: Initializes the router with `bootstrap_ro.connection_sharing=1` to prevent connection exhaustion during high-concurrency testing.

## 7. Troubleshooting: WSL Background Termination
If you notice that `mysql-router` is stuck in a crash loop or containers keep restarting:
1. **The Cause**: Windows Subsystem for Linux (WSL) will automatically suspend and terminate background distributions if there is no active Windows session holding it open. This kills the Docker daemon mid-flight and corrupts the InnoDB cluster state.
2. **The Fix**: The `recreate-ecosystem.mjs` script automatically registers the WSL keepalive task natively on every run. You do not need to run a standalone PowerShell script.
3. **Recovery**: After ensuring the `WSL-KeepAlive` task is "Running" in Task Scheduler, you MUST fully rebuild the corrupted cluster by running `node scripts/recreate-ecosystem.mjs` again.

# MySQL Test Infrastructure

_Updated: July 2026_

> **Value Proposition**
> Ensure production-grade reliability with a comprehensive, lightweight test ecosystem. Instantly spin up a complete InnoDB Cluster, MySQL Router, and ProxySQL topology integrated with Datadog observability to rigorously validate your AI agents against complex database scenarios.

This directory contains the `docker-compose.yml` for the MySQL-focused test infrastructure used by mysql-mcp integration tests. It is a lightweight subset of the full Adamic unified database ecosystem, automatically synchronized via the `sync-test-infra` workflow.

## 1. Quick Start

To spin up the test infrastructure from scratch (teardown + start + cluster bootstrap + seed):

```powershell
cd C:\Users\chris\Desktop\mysql-mcp\test-server\infrastructure
node scripts/recreate-test-ecosystem.mjs
```

If the cluster already exists and you just need to restart containers:

```powershell
docker compose up -d
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
| **Datadog Agent** | `datadog-unified`| `(network-internal only)` | `gcr.io/datadoghq/agent:7.81.0` |

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

- `recreate-test-ecosystem.mjs`: Single self-contained script that automates the entire lifecycle: Windows Host IP discovery, dynamic container discovery, orphaned container cleanup, teardown, startup, InnoDB Cluster bootstrap (with retry/healing), and database seeding.
- `recreate-ecosystem.mjs`: Same as above but without the Windows Host IP fetch (for direct WSL execution).
- `create-cluster.mjs`: Standalone cluster initializer. Not needed if using `recreate-test-ecosystem.mjs`.
- `check-status.mjs`: Dynamically discovers containers from `docker-compose.yml` and validates their health, plus checks the InnoDB Cluster quorum.
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
- `config/mysql/`: Contains `init.sql` which bootstraps initial users and dynamically installs the `validate_password` component to support MCP security tool testing.
- `config/proxysql/`: `proxysql.cnf`
- `config/prometheus/`: `prometheus.yml`
- `config/grafana/`: Dashboards and provisioning files.
- `config/datadog-integration-configs/`: Integration configs for MySQL and Redis checks (ProxySQL uses Docker Autodiscovery labels instead), plus host system check defaults (cpu, memory, disk, io, load, network, ntp, file_handle, uptime).
- `config/mysql-router/`: Initializes the router with `bootstrap_ro.connection_sharing=1` to prevent connection exhaustion during high-concurrency testing.

## 7. Troubleshooting: WSL Background Termination
If you notice that `mysql-router` is stuck in a crash loop or containers keep restarting:
1. **The Cause**: Windows Subsystem for Linux (WSL) will automatically suspend and terminate background distributions if there is no active Windows session holding it open. This kills the Docker daemon mid-flight and corrupts the InnoDB cluster state.
2. **The Fix**: Open PowerShell and run the keepalive registration script:
   `pwsh.exe -File scripts\register-wsl-keepalive.ps1`
3. **Recovery**: After ensuring the `WSL-KeepAlive` task is "Running" in Task Scheduler, you MUST fully rebuild the corrupted cluster by running `node scripts/recreate-test-ecosystem.mjs` again.

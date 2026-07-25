# MySQL Ecosystem Setup Guide (Test Environment)

**🤖 AGENT OPTIMIZED README**

_Updated: July 2026_

This guide explains how to spin up, manage, and troubleshoot the derived MySQL test server ecosystem (InnoDB Cluster, Redis, MySQL Router, ProxySQL) for `mysql-mcp`.

> **Note on Datadog:** This environment includes full Datadog Agent monitoring with host-level system metrics (CPU, memory, disk, I/O, load, network), Docker container monitoring, process collection, eBPF system-probe (network performance monitoring), APM tracing, and database integrations (MySQL, Redis, ProxySQL). Native Prometheus and Grafana are also available as secondary observability.

---

## 1. Quick Start: Recreating the Cluster

The entire process of tearing down, spinning up the containers, and bootstrapping Group Replication is automated and idempotent.

```powershell
cd test-server/infrastructure
node scripts/recreate-ecosystem.mjs
```

This single self-contained script handles the entire lifecycle:
- Dynamically discover all services from `docker-compose.yml` (no hardcoded container lists).
- Forcefully clean up orphaned containers to prevent naming collisions.
- Tear down the existing cluster and volumes (`docker compose down -v`).
- Start the fresh containers (`docker compose up -d --build`).
- Wait for all MySQL nodes to be healthy (up to 60 retries).
- Bootstrap the InnoDB Cluster: create on primary, add secondaries with clone recovery.
- Auto-heal with `rebootClusterFromCompleteOutage()` if the cluster appears unstable.
- Leverage the `cluster-healer` service for ongoing background auto-recovery and `group_seeds` normalization.
- Seed the test database via `reset-database.mjs`.

### Verifying Ecosystem Health
Before running E2E tests, you can verify that all necessary containers are healthy and that the InnoDB cluster quorum is fully `ONLINE` by running:
```powershell
node scripts/check-status.mjs
```

---

## 2. Architecture Overview

This ecosystem includes all necessary components to validate the entire Adamic unified architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Docker Network: unified-database-ecosystem-default         │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                       │
│  │ mysql-node1  │  │ mysql-node2  │  │ mysql-node3  │                       │
│  │   PRIMARY    │  │  SECONDARY   │  │  SECONDARY   │                       │
│  │  Port: 3307  │  │  Port: 3308  │  │  Port: 3309  │                       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                       │
│         │                 │                 │                                │
│         └────────────┬────┴─────────────────┘                                │
│                      ▼                                                       │
│           [ 🔧 cluster-healer service (Auto-recovery) ]                      │
│                      ▼                                                       │
│            ┌──────────────────┐           ┌──────────────┐                   │
│            │   MySQL Router   │           │   ProxySQL   │                   │
│            │ RW: 6446 RO:6447 │           │ Admin: 6032  │                   │
│            │ REST API: 8443   │           │ Data:  6033  │                   │
│            └──────────────────┴───────────┴──────────────┘                   │
│                                                                              │
│            ┌──────────────────┐           ┌──────────────┐                   │
│            │    Prometheus    │           │   Grafana    │                   │
│            │   Port: 9090     │           │  Port: 3001  │                   │
│            └──────────────────┘           └──────────────┘                   │
│                                                                              │
│            ┌──────────────────┐           ┌──────────────┐                   │
│            │       Loki       │           │   Promtail   │                   │
│            │   Port: 3100     │           │  (Internal)  │                   │
│            └──────────────────┴───────────┴──────────────┘                   │
│                                                                              │
│                           ┌──────────────┐                                   │
│                           │ Redis Server │                                   │
│                           │  Port: 6379  │                                   │
│                           └──────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Disaster Recovery & Operations

### Data Reset (Re-seed E2E Test DB)
If you need to re-seed the `testdb` for the E2E tests without tearing down the entire cluster:
```powershell
node scripts/reset-database.mjs
```

### Cluster Healer Service
The environment runs a `cluster-healer` Docker sidecar service that automatically monitors the MySQL cluster and handles disaster recovery.

- **How it works:** It polls all 3 nodes every 30 seconds.
- **Complete Outage:** If the cluster loses quorum (all nodes down), it runs `dba.rebootClusterFromCompleteOutage()`.
- **Individual Node Drops:** If a node falls offline or gets out of sync, it forces a rejoin via `START GROUP_REPLICATION`.

To view its logs and check recovery actions:
```powershell
docker logs -f cluster-healer
```

---

## 4. Connection Details

### MySQL (via InnoDB Cluster)
| Property | Value |
|---|---|
| Primary (R/W) | `localhost:3307` |
| Read Replicas (R/O) | `localhost:3308`, `localhost:3309` |
| User | `root` |
| Password | `root` |

### MySQL Router
| Property | Value |
|---|---|
| REST API URL | `https://localhost:8443` |
| REST API User | `rest_api` |
| REST API Password | `router_api` |
| RW Routing Port | `6446` (→ PRIMARY) |
| RO Routing Port | `6447` (→ SECONDARY) |

### Observability & Tools
| Property | URL |
|---|---|
| Prometheus | `http://localhost:9090` |
| Loki | `http://localhost:3100` |
| Promtail | `(network-internal only)` |
| Grafana | `http://localhost:3001` (admin/admin) |
| Dozzle (Logs) | `http://localhost:8080` |
| Adminer (DB UI) | `http://localhost:8081` (Server: `mysql-node1`, User: `root`, Pass: `root`) |
| ProxySQL Admin | `localhost:6032` |
| Redis | `localhost:6379` |
| Datadog AI Efficiency | `https://app.datadoghq.com/dashboard/q48-mq9-3i7` (Tracks `mysql-mcp` cache, pool metrics, and error rates) |
| Datadog Custom Dashboard | `https://app.datadoghq.com/dashboard/iae-57y-br7` (Includes the **MySQL-MCP Audit Log** widget `source:mysql_mcp log_type:mcp_audit`) |
| Datadog MySQL Overview | `https://app.datadoghq.com/dash/integration/12/mysql---overview` |
| Datadog Local Backups | `config/datadog-*.json` (e.g. AI Efficiency, Redis, MySQL) |
| Datadog Host Map | `https://app.datadoghq.com/infrastructure/map` (look for `adamic-wsl2`) |
| Datadog Containers | `https://app.datadoghq.com/containers` |
| Datadog Live Processes | `https://app.datadoghq.com/process` |

---

## 5. WSL2 Stability (Critical)

This environment runs on **native `docker-ce` inside WSL2 Ubuntu** (no Docker Desktop). WSL2 has a known failure mode where the distro instance is terminated when no Windows-side WSL client sessions are holding it open, which kills Docker and all containers.

### Keepalive Mechanism
A Windows Scheduled Task (`WSL-KeepAlive`) runs at user logon. It executes `scripts/wsl-keepalive.vbs`, which launches `wsl.exe -d Ubuntu-24.04 --exec sleep infinity` with a hidden window. This holds the distro alive indefinitely.

### Diagnosing Crashes
If containers are cycling (green → red → green repeatedly) or `mysql-router` is stuck in an initialization loop failing to join the cluster:

1. **Check if WSL is rebooting:** `wsl bash -c "journalctl --list-boots"` — multiple short-lived boots = WSL termination issue.
2. **Check for the smoking gun:** `wsl bash -c "dmesg | grep InitTerminateInstanceInternal"` — this message means WSL sent `systemctl poweroff` to the distro.
3. **Check the keepalive task:** `Get-ScheduledTask -TaskName 'WSL-KeepAlive' | Select State` — must be `Running`. (If `Ready` or `Stopped`, run `register-wsl-keepalive.ps1`).
4. **Check Docker daemon:** `wsl bash -c "systemctl status docker"` — must be `active (running)`.
5. **Check iptables backend:** The kernel (`6.18+`) requires `iptables-nft`. If Docker fails to start, check `/etc/docker/daemon.json` and `update-alternatives --display iptables`.

### Key Config Files
| File | Purpose |
|---|---|
| `C:\Users\chris\.wslconfig` | WSL2 VM config: memory, swap, `vmIdleTimeout=-1` |
| `/etc/docker/daemon.json` | Docker storage driver, log rotation |
| `/etc/systemd/system/wsl-keepalive.service` | Backup in-distro keepalive (defense-in-depth) |
| `scripts/wsl-keepalive.vbs` | Hidden launcher for the Windows Scheduled Task |

### Windows Firewall & Prometheus Scraping
When Prometheus runs inside WSL and needs to scrape `mysql-mcp` running on the Windows host, the default WSL virtual network adapter (`192.168.48.1`) often blocks incoming traffic due to the Windows Firewall "Public" profile. To bypass this frictionlessly, `docker-compose.yml` maps `host.docker.internal` to the Windows physical adapter IP (`192.168.1.70` by default via `${WINDOWS_HOST_IP:-192.168.1.70}`).

### Datadog Agent Verification

The `datadog-unified` container runs with `pid: host` to enable full host-level system metrics from within the container. Hostname: `adamic-wsl2`.

```bash
# Verify all system checks are running (cpu, memory, disk, io, load, network, ntp, file_handle, uptime)
docker exec datadog-unified agent status | grep -E '(cpu|memory|disk|io|ntp|file_handle|load|uptime|network) \('

# Verify process agent sees host processes (should show >100)
docker exec datadog-unified agent status | grep "Number of processes"

# Verify container monitoring
docker exec datadog-unified agent status | grep -c 'Instance ID'

# Verify system-probe (eBPF)
docker exec datadog-unified agent status | grep -A 3 'System Probe'
```

> **System metrics on WSL2:** Metrics represent the WSL2 Linux VM (not Windows directly). Since all workloads run inside this VM, these metrics accurately reflect the compute environment.

### MySQL 9.x Observability & Config Flags

- **`--binlog_format=ROW`**: This flag has been fully removed as it is deprecated in MySQL 9.x.
- **ProxySQL Config**: The `proxysql.cnf` volume is mounted as read-only (`:ro`) to prevent the container from overwriting the local file.
- **WSL Scripting**: Startup scripts avoid using blocking `ping` commands to simulate sleep in WSL, using non-blocking `await setTimeout(...)` instead to prevent process hangs.
- **`validate_password` Component**: The `validate_password` component has been REMOVED from `init.sql` because it corrupts the `mysql.user` data dictionary (52 columns vs expected 51), which breaks the MySQL Router 9.1.0 bootstrap process. It is no longer installed at startup.
- **`group_replication_ip_allowlist` & `group_seeds`**: The `recreate-ecosystem.mjs` script automatically sets `group_replication_ip_allowlist` to `AUTOMATIC` and normalizes `group_seeds` to include all 3 nodes.
- **`--relay-log`**: Each MySQL node sets an explicit relay log filename (`--relay-log=mysql-nodeX-relay-bin`) to prevent replication breakage if the container hostname changes during recovery.
- **MySQL Router**: Connection sharing for the read-only bootstrap pool is explicitly enabled (`bootstrap_ro.connection_sharing=1`) to prevent connection exhaustion during concurrent MCP testing.
- **Audit Logging**: The Datadog `MySQL-MCP Audit Log` widget queries `source:mysql_mcp log_type:mcp_audit` (no `@` symbol, as Datadog integration tags are infrastructure tags, not JSON attributes). To log read-scoped tools (like `mysql_read_query`), you must explicitly add `--audit-reads` to the `mysql-mcp` startup arguments.

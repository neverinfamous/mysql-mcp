# MySQL Test Infrastructure Setup Guide

**🤖 AGENT OPTIMIZED README**

_Updated: July 2026_

This guide explains how to spin up, manage, and troubleshoot the MySQL-focused test infrastructure (InnoDB Cluster, MySQL Router, ProxySQL, Redis) for the mysql-mcp integration testing environment.

---

## 1. Quick Start: Recreating the Cluster

The entire process of tearing down, spinning up the containers, and bootstrapping Group Replication is automated and idempotent.

```powershell
cd test-server/infrastructure
node scripts/recreate-test-ecosystem.mjs
```

This single self-contained script handles the entire lifecycle:
- Fetch the Windows Host IP for Prometheus scraping.
- Dynamically discover all services from `docker-compose.yml` (no hardcoded container lists).
- Forcefully clean up orphaned containers to prevent naming collisions.
- Tear down the existing cluster and volumes (`docker compose down -v`).
- Start the fresh containers (`docker compose up -d`).
- Wait for all MySQL nodes to be healthy (up to 60 retries).
- Bootstrap the InnoDB Cluster: create on primary, add secondaries with clone recovery.
- Auto-heal with `rebootClusterFromCompleteOutage()` if the cluster appears unstable.
- Seed the test database via `reset-database.mjs`.

### Verifying Ecosystem Health
Before running E2E tests, you can verify that all necessary containers are healthy and that the InnoDB cluster quorum is fully `ONLINE` by running:
```powershell
node scripts/check-status.mjs
```

---

## 2. Architecture Overview

This ecosystem includes the MySQL-focused components needed for mysql-mcp integration testing:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Docker Network: infrastructure_default                    │
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
│            └──────────────────┴───────────┴──────────────┘                   │
│                                                                              │
│            ┌──────────────────┐           ┌──────────────┐                   │
│            │    Prometheus    │           │   Grafana    │                   │
│            │   Port: 9090     │           │  Port: 3001  │                   │
│            └──────────────────┘           └──────────────┘                   │
│                                                                              │
│       ┌──────────────┐                                                       │
│       │ Redis Server │                                                       │
│       │  Port: 6379  │                                                       │
│       └──────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Disaster Recovery & Operations

### Data Reset (Re-seed E2E Test DB)
If you need to re-seed the `testdb` for the E2E tests without tearing down the entire cluster:
```powershell
node scripts/reset-database.mjs
```

### Manual Cluster Recovery
If containers are restarted and the cluster fails to auto-recover via `SET PERSIST`:
```powershell
node scripts/reboot-cluster.mjs
```
This script executes `dba.rebootClusterFromCompleteOutage()`.

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
| Grafana | `http://localhost:3001` (admin/admin) |
| Dozzle (Logs) | `http://localhost:8080` |
| Adminer (DB UI) | `http://localhost:8081` (Server: `mysql-node1`, User: `root`, Pass: `root`) |
| ProxySQL Admin | `localhost:6032` |
| Redis | `localhost:6379` |
| Datadog Custom Dashboard | `https://app.datadoghq.com/dashboard/iae-57y-br7` |
| Datadog MySQL Overview | `https://app.datadoghq.com/dash/integration/12/mysql---overview` |
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
- **`validate_password` Component**: The `init.sql` script dynamically installs the `validate_password` component at startup to support MCP security tool testing (`mysql.security.passwordValidate`).
- **`--relay-log`**: Each MySQL node sets an explicit relay log filename (`--relay-log=mysql-nodeX-relay-bin`) to prevent replication breakage if the container hostname changes during recovery.
- **MySQL Router**: Connection sharing for the read-only bootstrap pool is explicitly enabled (`bootstrap_ro.connection_sharing=1`) to prevent connection exhaustion during concurrent MCP testing.

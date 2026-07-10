# MySQL Ecosystem Setup Guide (Test Environment)

**🤖 AGENT OPTIMIZED README**

_Updated: July 2026_

This guide explains how to spin up, manage, and troubleshoot the lightweight MySQL test ecosystem (InnoDB Cluster, MySQL Router, ProxySQL) designed specifically for testing the `mysql-mcp` project.

> **Note on Datadog:** This environment includes native Prometheus and Grafana for metrics observability. If you require full Datadog tracing/APM, you will need to manually inject a Datadog Agent container; it is omitted here to keep the test infrastructure lightweight.

---

## 1. Quick Start: Recreating the Cluster

The entire process of tearing down, spinning up the containers, and bootstrapping Group Replication is automated and idempotent.

```powershell
cd test-server/infrastructure
node scripts/recreate-test-ecosystem.mjs
```

This master script will:
- Tear down the existing cluster and volumes (`docker compose down -v`).
- Start the fresh test containers (`docker compose up -d`).
- Automatically poll the nodes until they are healthy.
- Initialize the primary node (`mysql-node1`) as the cluster creator.
- Join `mysql-node2` and `mysql-node3` to the cluster.
- Output the final cluster topology.

---

## 2. Architecture Overview

This test ecosystem includes only the necessary components to validate the `mysql-mcp` server:

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

---

## 5. WSL2 Stability (Critical)

This environment runs on **native `docker-ce` inside WSL2 Ubuntu** (no Docker Desktop). WSL2 has a known failure mode where the distro instance is terminated when no Windows-side WSL client sessions are holding it open, which kills Docker and all containers.

### Keepalive Mechanism
A Windows Scheduled Task (`WSL-KeepAlive`) runs at user logon. It executes `scripts/wsl-keepalive.vbs`, which launches `wsl.exe -d Ubuntu-24.04 --exec sleep infinity` with a hidden window. This holds the distro alive indefinitely.

### Diagnosing Crashes
If containers are cycling (green → red → green repeatedly):

1. **Check if WSL is rebooting:** `wsl bash -c "journalctl --list-boots"` — multiple short-lived boots = WSL termination issue.
2. **Check for the smoking gun:** `wsl bash -c "dmesg | grep InitTerminateInstanceInternal"` — this message means WSL sent `systemctl poweroff` to the distro.
3. **Check the keepalive task:** `Get-ScheduledTask -TaskName 'WSL-KeepAlive' | Select State` — must be `Running`.
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

### MySQL 9.x Observability Flags
- **`--container_aware=ON`**: Required to prevent MySQL from ignoring discovered container memory restrictions.
- **`--binlog_format=ROW`**: This flag has been fully removed as it is deprecated in MySQL 9.x.
- **ProxySQL Config**: The `proxysql.cnf` volume is mounted as read-only (`:ro`) to prevent the container from overwriting the local file.
- **WSL Scripting**: Startup scripts avoid using blocking `ping` commands to simulate sleep in WSL, using non-blocking `await setTimeout(...)` instead to prevent process hangs.

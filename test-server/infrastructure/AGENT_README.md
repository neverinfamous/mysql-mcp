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
node test-server/infrastructure/scripts/reset-database.mjs
```

### Manual Cluster Recovery
If containers are restarted and the cluster fails to auto-recover via `SET PERSIST`:
```powershell
node test-server/infrastructure/scripts/reboot-cluster.mjs
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

### Observability
| Property | URL |
|---|---|
| Prometheus | `http://localhost:9090` |
| Grafana | `http://localhost:3001` (admin/admin) |
| ProxySQL Admin | `localhost:6032` |

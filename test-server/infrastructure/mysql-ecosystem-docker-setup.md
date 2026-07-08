# MySQL Ecosystem Setup Guide

**🤖 AGENT OPTIMIZED README**

_Updated: July 2026_

This guide explains how to spin up, manage, and troubleshoot the MySQL Ecosystem (InnoDB Cluster, MySQL Router, ProxySQL) for the `mysql-mcp` project.

All infrastructure files are now consolidated under `test-server/infrastructure/`.

---

## 1. Quick Start: Spinning Up the Cluster

The entire process of starting the cluster and configuring Group Replication is automated and idempotent.

```powershell
# 1. Start the Docker containers (from the infrastructure directory)
cd test-server/infrastructure
docker compose -f innodb-cluster.yml up -d
cd ../..

# 2. Run the automated cluster configuration script
node test-server/infrastructure/scripts/create-cluster.mjs
```

This script will:
- Wait for all MySQL nodes to become healthy.
- Initialize the primary node (`mysql-node1`) as the cluster creator.
- Clone the data to `mysql-node2` and `mysql-node3` and join them to the cluster.
- Print the cluster topology status at the end.

---

## 2. Architecture Overview

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

## 3. Disaster Recovery & Reboots

### Cluster Auto-Recovery
The cluster containers use persistent Docker volumes (`mysql-nodeX-data-v4`). On a standard machine reboot or container restart, Group Replication will automatically recover because the configuration is saved via `SET PERSIST`.

### Complete Outage Recovery
If all nodes go down simultaneously and fail to bootstrap automatically upon startup, run the reboot script:

```powershell
node test-server/infrastructure/scripts/reboot-cluster.mjs
```
This script handles executing `dba.rebootClusterFromCompleteOutage()` correctly across the nodes.

### Data Reset
If you need to re-seed the test database for the E2E tests:
```powershell
node test-server/infrastructure/scripts/reset-database.mjs
```

### Complete Factory Reset
If you need to completely wipe the cluster and start from scratch (e.g., if clone recovery fails or you're stuck in a split-brain state):

```powershell
# 1. Stop and remove containers and volumes
cd test-server/infrastructure
docker compose -f innodb-cluster.yml down -v
cd ../..

# 2. Recreate from scratch
cd test-server/infrastructure
docker compose -f innodb-cluster.yml up -d
cd ../..
node test-server/infrastructure/scripts/create-cluster.mjs
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

### MySQL Router (Persistent Volume: `mysql-router-data`)
| Property | Value |
|---|---|
| REST API URL | `https://localhost:8443` |
| REST API User | `rest_api` |
| REST API Password | `router_api` |
| RW Routing Port | `6446` (→ PRIMARY) |
| RO Routing Port | `6447` (→ SECONDARY) |

*(Note: MySQL Router and ProxySQL are currently spun up separately via manual `docker run` commands if required, see older commits for manual setup if needed).*

---

## 5. Directory Layout

All local configurations are now in `test-server/infrastructure/`:
- `innodb-cluster.yml`: Docker Compose for the 3-node InnoDB cluster.
- `mysql-final-working.yml`: Backup docker-compose for standalone MySQL.
- `proxysql.cnf`: Configuration for ProxySQL.
- `cluster-config/`: Legacy `.cnf` files (kept for reference).
- `scripts/`: E2E automation scripts (`create-cluster.mjs`, `reboot-cluster.mjs`, `reset-database.mjs`).

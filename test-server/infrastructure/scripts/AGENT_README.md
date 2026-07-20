# Infrastructure Automation Scripts

**🤖 AGENT OPTIMIZED README**

_Updated: July 2026_

This directory contains the Node.js automation scripts for managing the mysql-mcp test infrastructure. This is a **satellite** of the `adamic` unified database ecosystem (Source of Truth).

## Execution Rules
- **[CRITICAL]** All `.mjs` scripts in this directory **MUST** be executed natively on the Windows host using `node <script_name>.mjs`. 
- **[NEVER]** run these scripts from inside the WSL container (`wsl bash -c "node ..."`) because they rely on native Windows `wsl.exe` calls to orchestrate Docker containers correctly across the OS boundary.

## Scripts Overview

### Lifecycle & Management
- `recreate-ecosystem.mjs`: Single self-contained script that automates the entire lifecycle: aggressive cleanup (orphan container detection, volume retry), startup, InnoDB Cluster bootstrap, group_seeds normalization, ip_allowlist configuration, and database seeding. **Use this as your primary hammer.**
- `check-status.mjs`: Dynamically discovers containers and validates their health, plus checks the InnoDB Cluster quorum.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`.

### Deleted Scripts (Consolidated)
- ~~`create-cluster.mjs`~~ — Absorbed into `recreate-ecosystem.mjs`.
- ~~`reboot-cluster.mjs`~~ — Replaced by the `cluster-healer` Docker sidecar (automatic recovery).
- ~~`recreate-test-ecosystem.mjs`~~ — Removed; was a near-duplicate of `recreate-ecosystem.mjs`.

### Auto-Recovery: `cluster-healer` (Docker Service)
The `cluster-healer` is a Docker sidecar service (not a script) defined in `docker-compose.yml`. It:
- Polls all 3 MySQL nodes every 30 seconds
- Detects complete outage → `dba.rebootClusterFromCompleteOutage()`
- Detects individual offline nodes → `START GROUP_REPLICATION` rejoin
- Reports health via Docker healthcheck (`/tmp/healer-healthy`)
- Logs: `docker logs -f cluster-healer`

### Observability & Load Testing
- `generate-metrics-load.mjs`: Utility script to simulate synthetic query load through ProxySQL to validate Datadog/Grafana metrics and cache hit ratios. Runs an infinite loop until killed.

### WSL Stability
- `register-wsl-keepalive.ps1` & `wsl-keepalive.vbs`: Sets up a Windows Scheduled Task to prevent the background WSL distro from being terminated by Windows power management (which would otherwise crash the Docker daemon).

## Syncing from Adamic

This test infrastructure is synced from the `adamic` mother repository:
```powershell
cd C:\Users\chris\Desktop\adamic
bun .\.agents\scripts\sync-test-infra.ts
```

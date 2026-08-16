# Infrastructure Automation Scripts

**🤖 AGENT OPTIMIZED README**

This directory contains the Node.js automation scripts for managing the unified database ecosystem.

## Execution Rules
- **[CRITICAL]** All `.mjs` scripts in this directory **MUST** be executed natively on the Windows host using `node <script_name>.mjs`. 
- **[NEVER]** run these scripts from inside the WSL container (`wsl bash -c "node ..."`) because they rely on native Windows `wsl.exe` calls to orchestrate Docker containers correctly across the OS boundary.

## Scripts Overview

### Lifecycle & Management
- `recreate-ecosystem.mjs`: Enhanced with dynamic container discovery, orphan container detection + retry, parallel volume cleanup, `group_seeds` normalization (Phase 6/9), `ip_allowlist='AUTOMATIC'`, per-phase timing, and raw SQL verification. **This is the single lifecycle management script.** Use this as your primary hammer.
- `check-status.mjs`: Comprehensive 8-section ecosystem validator. Checks: (1) container health, (2) InnoDB Cluster quorum, (3) MySQL Shell metadata, (4) Router R/W + R/O + REST API, ProxySQL backends + data port, Redis SET/GET cycle, (5) Prometheus health + scrape targets, Grafana, Loki (label indexing), Grafana Alloy HTTP status, (6) Datadog Docker-health + per-integration status, (7) MCP server metrics endpoint, (8) test database integrity (table presence + row counts). Exits non-zero if any hard check fails. Automatically detects and auto-heals `super_read_only` locks using `heal-primary.mjs`.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`. Catches `super_read_only` locks and aborts.
- `heal-primary.mjs`: Used to un-stick the primary node from `super_read_only=1` by manually cycling the primary election through a secondary node via `mysqlsh`. This is invoked automatically by `check-status.mjs` when a lock is detected, but can also be executed manually.

### Cluster Auto-Recovery
- **`cluster-healer`**: This is a Docker sidecar service (not a manual script) that runs continuously alongside the cluster. It polls all nodes every 30 seconds, automatically reboots the cluster from complete outages, and restarts group replication on individual disconnected nodes.

### WSL Stability
- `wsl-keepalive.vbs`: A Windows Scheduled Task is automatically set up by `recreate-ecosystem.mjs` (via `utils.mjs`) to run an invisible VBS script that prevents the background WSL distro from being terminated by Windows power management (which would otherwise crash the Docker daemon).

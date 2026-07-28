# Infrastructure Automation Scripts

**🤖 AGENT OPTIMIZED README**

This directory contains the Node.js automation scripts for managing the unified database ecosystem.

## Execution Rules
- **[CRITICAL]** All `.mjs` scripts in this directory **MUST** be executed natively on the Windows host using `node <script_name>.mjs`. 
- **[NEVER]** run these scripts from inside the WSL container (`wsl bash -c "node ..."`) because they rely on native Windows `wsl.exe` calls to orchestrate Docker containers correctly across the OS boundary.

## Scripts Overview

### Lifecycle & Management
- `recreate-ecosystem.mjs`: Enhanced with aggressive volume cleanup (orphan container detection + retry), `group_seeds` normalization, `ip_allowlist='AUTOMATIC'`, and raw SQL verification. **This is the single lifecycle management script.** Use this as your primary hammer.
- `check-status.mjs`: Comprehensive 7-section ecosystem validator. Checks: (1) container health, (2) InnoDB Cluster quorum, (3) MySQL Shell metadata, (4) Router R/W + R/O + REST API, ProxySQL backends + data port, Redis SET/GET cycle, (5) Prometheus health + scrape targets, Grafana, Loki, Promtail, (6) Datadog integration ERRORs/WARNINGs, (7) optional MCP server metrics endpoint. Exits non-zero if any hard check fails.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`.

### Cluster Auto-Recovery
- **`cluster-healer`**: This is a Docker sidecar service (not a manual script) that runs continuously alongside the cluster. It polls all nodes every 30 seconds, automatically reboots the cluster from complete outages, and restarts group replication on individual disconnected nodes.

### WSL Stability
- `register-wsl-keepalive.ps1`: Sets up a Windows Scheduled Task to prevent the background WSL distro from being terminated by Windows power management (which would otherwise crash the Docker daemon). It dynamically generates a VBS wrapper to hide the console window.

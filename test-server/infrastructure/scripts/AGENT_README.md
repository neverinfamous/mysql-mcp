# Infrastructure Automation Scripts

**🤖 AGENT OPTIMIZED README**

This directory contains the Node.js automation scripts for managing the unified database ecosystem.

## Execution Rules
- **[CRITICAL]** All `.mjs` scripts in this directory **MUST** be executed natively on the Windows host using `node <script_name>.mjs`. 
- **[NEVER]** run these scripts from inside the WSL container (`wsl bash -c "node ..."`) because they rely on native Windows `wsl.exe` calls to orchestrate Docker containers correctly across the OS boundary.

## Scripts Overview

### Lifecycle & Management
- `recreate-ecosystem.mjs`: Single self-contained script that automates the entire lifecycle: teardown, startup, InnoDB Cluster bootstrap (with retry/healing), and database seeding. **Use this as your primary hammer.**
- `create-cluster.mjs`: Standalone cluster initializer. (Usually invoked by `recreate-ecosystem.mjs`).
- `check-status.mjs`: Dynamically discovers containers and validates their health, plus checks the InnoDB Cluster quorum.
- `reboot-cluster.mjs`: Use this if all containers go offline at once and auto-bootstrap fails.
- `reset-database.mjs`: Drops and recreates the `testdb` for E2E testing on `mysql-node1`.

### Observability & Load Testing
- `generate-metrics-load.mjs`: Utility script to simulate synthetic query load through ProxySQL to validate Datadog/Grafana metrics and cache hit ratios. Runs an infinite loop until killed.

### WSL Stability
- `register-wsl-keepalive.ps1` & `wsl-keepalive.vbs`: Sets up a Windows Scheduled Task to prevent the background WSL distro from being terminated by Windows power management (which would otherwise crash the Docker daemon).

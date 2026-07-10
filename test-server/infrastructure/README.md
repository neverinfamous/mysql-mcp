# Test Infrastructure

Welcome to the `mysql-mcp` test infrastructure! This directory provides a complete, containerized test ecosystem (MySQL InnoDB Cluster, MySQL Router, ProxySQL, Prometheus, and Grafana) designed to run the End-to-End (E2E) integration tests for the `mysql-mcp` server.

We want to make it as easy as possible for you to test and contribute to this project. 

## Do I need to use this?

**No, you do not *have* to use Docker.** 

If you do not have Docker installed, or if you prefer to test against your own existing MySQL database, you can skip this entirely! The integration tests simply look for a live MySQL server running on `localhost:3306` (or `3307`). 
To use your own database, simply ensure your local MySQL server is running, and configure your connection strings (the tests default to user `root` and password `root`).

However, if you *do* have Docker installed (Docker Desktop or WSL containers), using this provided infrastructure is the easiest way to guarantee a perfectly clean, isolated environment that matches the CI pipeline.

## 1. Quick Start (One-Click Setup)

If you have Docker and Node.js installed, we've fully automated the teardown, launch, and complex Group Replication bootstrapping of the cluster.

Simply run the master recreation script from this directory:

```bash
node scripts/recreate-test-ecosystem.mjs
```

**What this script does:**
1. Wipes any old, stale test containers and data volumes (`docker compose down -v`).
2. Starts a fresh set of containers (`docker compose up -d`).
3. Automatically polls the MySQL nodes until they are healthy.
4. Initializes the primary node (`mysql-node1`) as the InnoDB cluster creator.
5. Joins the secondary read replicas (`mysql-node2` and `mysql-node3`) to the cluster.
6. Outputs the final `ONLINE` cluster topology to your terminal.

Once the script finishes, your cluster is ready and you can run the test suite from the root of the repository:
```bash
bun run test
```

## 2. Architecture

This environment spins up the following components:

- **MySQL Node 1 (Primary)**: `localhost:3307` (R/W)
- **MySQL Node 2 (Replica)**: `localhost:3308` (R/O)
- **MySQL Node 3 (Replica)**: `localhost:3309` (R/O)
- **MySQL Router**: `localhost:6446` (RW Routing), `localhost:6447` (RO Routing)
- **ProxySQL**: `localhost:6033` (Data), `localhost:6032` (Admin)
- **Prometheus**: `http://localhost:9090` (Metrics scraping)
- **Grafana**: `http://localhost:3001` (Dashboards - login: admin/admin)
- **Dozzle**: `http://localhost:8080` (Real-time container logs viewer)
- **Adminer**: `http://localhost:8081` (Web-based database management UI)
  - *Login details:* System: **MySQL**, Server: **mysql-node1**, Username: **root**, Password: **root**
- **Redis Server**: `localhost:6379` (Distributed rate-limiting cache)

All components share the `infrastructure_default` Docker network.

## 3. Useful Commands

**Re-seed the E2E Test Database**
If you have dirtied the `testdb` during manual testing and want to reset it without tearing down the entire cluster:
```bash
node scripts/reset-database.mjs
```

**Manual Cluster Recovery**
If you restart your computer or Docker daemon, the containers will restart, but the InnoDB cluster might fail to auto-recover its quorum. You can force a reboot from a complete outage with:
```bash
node scripts/reboot-cluster.mjs
```

## Troubleshooting

- **Port Conflicts**: If the `recreate-test-ecosystem.mjs` script fails to start containers due to port bindings (e.g., `3307` is already in use), ensure you don't have other local MySQL instances running on those ports.
- **Bootstrapping Timeouts**: Depending on your hardware, `create-cluster.mjs` might timeout while waiting for nodes to become ready. The script has deep retry logic (up to 60 retries), but if it still fails, you can safely re-run the `recreate-test-ecosystem.mjs` script to try again.

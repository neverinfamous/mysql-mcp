# Full Observability Ecosystem Template

> **Value Proposition**
> Deploy a complete telemetry stack instantly. Gain total visibility into your HA MySQL cluster.

This template provides a full Enterprise HA MySQL cluster (3 nodes). It includes MySQL Router, ProxySQL, an open-source telemetry stack, and Datadog integrations.

## Comprehensive Architecture

- **3x MySQL 9.x Nodes:** Configured for Group Replication (InnoDB Cluster).
- **1x MySQL Router:** Automatically tracks cluster topology and routes traffic to the primary node.
- **1x ProxySQL:** Connection pooling and query routing/caching on top of the router.
- **1x Redis:** Used for rate-limiting.
- **mysql-mcp-exporter:** The dedicated exporter for the `mysql-mcp` server.
- **Prometheus & Grafana:** For metrics collection and visualization.
- **Loki & Grafana Alloy:** For scraping and aggregating the MCP Audit Log.
- **Dozzle & Adminer:** For easy log viewing and database administration.
- **1x Datadog Agent:** Pre-configured with Autodiscovery to automatically parse metrics.

## Launch in Seconds

1. **Configure Environment:**
   Copy the example environment file and insert your Datadog API key (if using Datadog).
   ```bash
   cp .env.example .env
   # Edit .env and set your DD_API_KEY
   ```

2. **Start the Infrastructure:**
   ```bash
   docker compose up -d
   ```

3. **Bootstrap the Cluster:**
   Once `mysql-node1` is healthy, run the initialization script to bootstrap the Group Replication cluster across all 3 nodes.
   *(Note: The internal `cluster-healer` service in this compose file will attempt to bootstrap automatically if you don't do it manually.)*

## Access Observability Tools

Once running, access the tools via your browser:

- **Grafana**: [http://localhost:3001](http://localhost:3001) (Login: `admin` / `admin`)
  - Pre-loaded with dashboards for `Token & Tool Metrics`, `AI Efficiency`, and `MySQL Cluster Telemetry`.
- **Prometheus**: [http://localhost:9090](http://localhost:9090)
- **Dozzle** (Container Logs): [http://localhost:8080](http://localhost:8080)
- **Adminer** (DB UI): [http://localhost:8081](http://localhost:8081)
  - Server: `mysql-node1`
  - User: `root`
  - Password: `root`

## Connect to the Stack

Connect to this stack using ProxySQL on port `6033`. Point the MCP audit log at the correct path for scraping.

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": [
        "-y", 
        "@neverinfamous/mysql-mcp",
        "--audit-log",
        "./examples/full-observability-ecosystem/logs/mcp-audit.jsonl"
      ],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "6033",
        "MYSQL_USER": "cluster_admin",
        "MYSQL_PASSWORD": "cluster_admin",
        "MYSQL_DATABASE": "testdb",
        "MYSQLSH_PORT": "3307"
      }
    }
  }
}
```

## Learn More

For deep dives into the telemetry architecture, dashboard insights, and the rationale behind this setup, check out the official `mysql-mcp` wiki:
- [Observability & Telemetry](https://github.com/neverinfamous/mysql-mcp/wiki/Observability)
- [Test Ecosystem Blueprint](https://github.com/neverinfamous/mysql-mcp/wiki/Test-Ecosystem)

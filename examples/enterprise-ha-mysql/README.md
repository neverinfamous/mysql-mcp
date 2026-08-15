# Enterprise HA MySQL + Datadog Template

> **Value Proposition**
> Deploy a resilient, enterprise-grade MySQL cluster. Get HA routing, pooling, and observability instantly.

This template deploys an enterprise-grade High-Availability (HA) MySQL architecture. It is fully monitored by Datadog.

## Resilient Architecture
- **3x MySQL 9.x Nodes:** Configured for Group Replication (InnoDB Cluster).
- **1x MySQL Router:** Automatically tracks cluster topology and routes traffic to the primary node.
- **1x ProxySQL:** Connection pooling and query routing/caching on top of the router.
- **1x Datadog Agent:** Pre-configured with Autodiscovery to automatically parse metrics from MySQL and ProxySQL.

## Launch in Seconds

1. **Configure Environment:**
   Copy the example environment file and insert your Datadog API key.
   ```bash
   cp .env.example .env
   # Edit .env and set your DD_API_KEY
   ```

2. **Start the Infrastructure:**
   ```bash
   docker compose up -d
   ```

3. **Bootstrap the Cluster:**
   Once `example-ha-node1` is healthy, run the initialization script to bootstrap the Group Replication cluster across all 3 nodes:
   ```bash
   bash init-cluster.sh
   ```
   *(Note: The MySQL Router will automatically configure itself and start routing once it detects the cluster is ready.)*

## Connect to the Cluster

The most resilient connection is through ProxySQL (Port 6043). Add the following to your MCP configuration. Note: ProxySQL is bypassed for the X protocol connection.

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@neverinfamous/mysql-mcp"],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "6043",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "mcp_password",
        "MYSQL_DATABASE": "testdb",
        "MYSQLSH_PORT": "3317"
      }
    }
  }
}
```

## Datadog Dashboards

Once data is flowing, you can monitor your infrastructure using the pre-configured custom dashboards included in this repository.

See the [Dashboards Documentation](../dashboards/README.md) to import the custom **MySQL Cluster Telemetry**, **AI Efficiency**, and **Token & Tool Metrics** dashboards into your Datadog account.

You can also use the native Datadog integrations:
- [MySQL Integration Overview](https://app.datadoghq.com/dash/integration/12/mysql---overview)
- [ProxySQL Integration](https://app.datadoghq.com/dash/integration/244/proxysql---overview)

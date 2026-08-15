# Basic MySQL + Datadog Template

This is a lightweight, out-of-the-box infrastructure template for users who want to run a simple MySQL 9.x database with full Datadog observability (Metrics, Logs, APM, and System Probes) to use with the `mysql-mcp` server.

## Features
- **Zero-config Telemetry:** The Datadog Agent is pre-configured to automatically discover the MySQL container and parse its logs and metrics.
- **Lightweight:** Runs only the database and the Datadog Agent.

## Quick Start

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

3. **Verify Health:**
   Wait a few seconds, then ensure the containers are running and healthy:
   ```bash
   docker ps
   ```

## Connecting with `mysql-mcp`

Once the database is running, you can connect the `mysql-mcp` server to it by adding the following to your Claude Desktop or Cursor MCP configuration:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "@neverinfamous/mysql-mcp"],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3316",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "mysqlmcp",
        "MYSQL_DATABASE": "testdb",
        "MYSQLSH_PORT": "3316"
      }
    }
  }
}
```

## Datadog Dashboards

Once data is flowing, you can monitor your database using the pre-configured custom dashboards included in this repository.

See the [Dashboards Documentation](../dashboards/README.md) to import the custom **MySQL Cluster Telemetry** and **Token & Tool Metrics** dashboards into your Datadog account.

You can also use the native Datadog integrations:
- [MySQL Integration Overview](https://app.datadoghq.com/dash/integration/12/mysql---overview)
- [Docker Containers](https://app.datadoghq.com/containers)

# Datadog Custom Dashboards

This directory contains pre-configured Datadog dashboard templates that you can import directly into your Datadog account.

## Included Dashboards

- `datadog-tool-performance.json`: The core **Token & Tool Metrics** dashboard. Tracks MCP tool invocations, latencies, and token consumption.
- `datadog-ai-efficiency.json`: The **AI Efficiency** dashboard. Tracks cost metrics, cache hit rates, connection pooling efficiency, MySQL Shell metrics, and the `MySQL Shell Status` widget (`.fill(last)`).
- `datadog-mysql.json`: The **MySQL Cluster Telemetry** dashboard. Provides deep insights into InnoDB Cluster replication, ProxySQL routing, and raw MySQL performance.
- `datadog-redis.json`: The **Redis Telemetry** dashboard.

## How to Import

1. Open Datadog and navigate to **Dashboards** > **New Dashboard**.
2. Click the gear icon (⚙️) in the top right and select **Import dashboard JSON**.
3. Copy the contents of the desired JSON file from this directory and paste it into the Datadog import prompt.
4. Click **Import**.

# Datadog Custom Dashboards

This directory contains pre-configured Datadog dashboard templates that you can import directly into your Datadog account.

## Included Dashboards

- `datadog-dashboard.json`: The core **Token & Tool Metrics** dashboard. Tracks MCP tool invocations, latencies, and token consumption.
- `datadog-ai-dashboard.json`: The **AI Efficiency** dashboard. Tracks cost metrics, cache hit rates, and connection pooling efficiency.
- `datadog-mysql.json`: The **MySQL Cluster Telemetry** dashboard. Provides deep insights into InnoDB Cluster replication, ProxySQL routing, and raw MySQL performance.

## How to Import

1. Open Datadog and navigate to **Dashboards** > **New Dashboard**.
2. Click the gear icon (⚙️) in the top right and select **Import dashboard JSON**.
3. Copy the contents of the desired JSON file from this directory and paste it into the Datadog import prompt.
4. Click **Import**.

# Datadog Custom Dashboards

> **Value Proposition**
> Unlock deep telemetry insights immediately. Import pre-configured dashboards to monitor tools, AI efficiency, and clusters.

This directory contains pre-configured Datadog dashboard templates. You can import them directly into your Datadog account.

## Pre-Configured Dashboards

- `datadog-ai-efficiency.json`: The **AI Efficiency** dashboard. Tracks cost metrics, cache hit rates, connection pooling efficiency, MySQL Shell metrics, and the `MySQL Shell Status` widget (`.fill(last)`).
- `datadog-tool-performance.json`: The core **Token & Tool Metrics** dashboard. Tracks MCP tool invocations, latencies, and token consumption.
- `datadog-infrastructure.json`: The **Infrastructure Telemetry** dashboard. Core Token and Tool Metrics, including the live **MySQL-MCP Audit Log** stream.
- `datadog-mysql.json`: The **MySQL Cluster Telemetry** dashboard. Provides deep insights into InnoDB Cluster replication, ProxySQL routing, and raw MySQL performance.
- `datadog-redis.json`: The **Redis Telemetry** dashboard. Tracks Redis rate-limiting, cache hits, memory usage, and command rates.
- `datadog-logs.json`: The **Logs** dashboard. Aggregates live MySQL-MCP audit logs and general container streams.
- `lib-agent-exec.json`: Observability for Antigravity's agent execution wrapper (`lib-agent-exec`).
- `datadog-dashboard.json`: General or proxy dashboard metrics.

## Import in Seconds

1. Open Datadog and navigate to **Dashboards** > **New Dashboard**.
2. Click the gear icon (⚙️) in the top right and select **Import dashboard JSON**.
3. Copy the contents of the desired JSON file from this directory and paste it into the Datadog import prompt.
4. Click **Import**.

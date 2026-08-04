# 📊 Observability Configuration

This directory contains the configuration files and JSON backups for the local testing ecosystem's observability stack. 

> [!IMPORTANT]
> **Dashboard File Placements**
> For automated provisioning to work correctly, dashboards must be placed in their respective locations:
> - **Datadog Dashboards** (`datadog-*.json`): Remain in the root of `config/`. These are not automatically loaded by a container; they serve as backups to be synced manually or via the `pup` CLI.
> - **Grafana Dashboards** (`grafana-*.json`): MUST be placed in `config/grafana/dashboards/`. The Grafana container automatically provisions any JSON files found in that subdirectory on startup.

## Available Dashboards

### Datadog
- `datadog-ai-efficiency.json`: Deep AI efficiency metrics (tokens, tool usage) and database insights.
- `datadog-tool-performance.json`: Tool usage and latency metrics.
- `datadog-infrastructure.json`: Core Token and Tool Metrics, including the live **MySQL-MCP Audit Log** stream.
- `datadog-mysql.json`: MySQL cluster health, queries, and replication status.
- `datadog-redis.json`: Redis rate-limiting, cache hits, memory usage, and command rates.
- `lib-agent-exec.json`: Observability for Antigravity's agent execution wrapper (lib-agent-exec).

### Grafana
- `grafana-ai-dashboard.json`: Local Grafana equivalent of the AI dashboard.
- `grafana-dashboard.json`: Local Grafana equivalent of the core metrics dashboard.
- `grafana-logs.json`: Promtail/Loki log aggregation view.

## Integration Configs
The `datadog-integration-configs/` folder contains the YAML configurations mounted directly into the Datadog Agent container to monitor the local MySQL nodes, ProxySQL, and Redis.

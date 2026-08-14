# Observability Guide

## Observability Architecture

Two-pillar model provides both AI-facing and ops-facing visibility into `mysql-mcp`.

**Pillar 1 — MCP Resources (AI-facing)**
Proactive database state endpoints agents query directly — no tool call overhead:
`mysql://health`, `mysql://schema`, `mysql://performance`, `mysql://metrics`, `mysql://audit`, `mysql://insights`
These return structured database intelligence: connection status, schema topology, slow queries, resource counters, audit events, and optimizer recommendations.

**Pillar 2 — System Telemetry (Ops-facing)**
Passive operational metrics exported to external platforms:
- **Prometheus** — `/metrics` endpoint scraped on interval
- **Grafana** — pre-loaded dashboards for tool, token, cluster, and cache metrics
- **Datadog Agent** — autodiscovery + eBPF for MySQL, Redis, ProxySQL checks
- **Loki / Alloy** — JSONL audit log pipeline for structured log queries

Tracked signals: tool invocation counts, latencies, error rates, token consumption, connection pool utilization, InnoDB internals.

## Verification Workflows

### MCP Metrics Endpoint

`mysql-mcp` exposes `/metrics` on its HTTP port when started with `--transport http --metrics-export prometheus`.

```bash
curl http://localhost:<port>/metrics
```

Expected: Prometheus text format. Key metrics:

| Metric | Description |
|---|---|
| `mcp_tool_invocations_total` | Counter per tool name |
| `mcp_tool_duration_seconds` | Histogram of tool execution time |
| `mcp_tool_errors_total` | Counter of failed tool calls |
| `mcp_tokens_estimated_total` | Estimated token consumption |

### Prometheus Scrape Health

Check targets page — all should show `UP`:
```
http://localhost:9090/targets
```

Query test — value should be `1`:
```
http://localhost:9090/api/v1/query?query=up
```

> [!IMPORTANT]
> Prometheus scrapes `host.docker.internal:<port>` which maps to `${WINDOWS_HOST_IP}` to bypass Windows Firewall. If targets show `DOWN`, verify the host IP mapping in `prometheus.yml`.

### Grafana Dashboard Verification

Access: `http://localhost:3001` — default credentials: `admin` / `admin`

Pre-loaded dashboards:
- Token & Tool Metrics
- AI Efficiency
- MySQL Cluster Telemetry
- Redis Telemetry

**[WHEN]** panels show "No data" → **[ALWAYS]** verify the Prometheus data source is connected at `http://prometheus:9090` under Configuration → Data Sources.

### Datadog Agent Verification

Status check:
```bash
docker exec datadog-unified agent status
```

Key sections to verify:

| Section | Expected State |
|---|---|
| Collector | Running checks: `mysql`, `redis`, `proxysql` |
| APM Agent | Running |
| System Probe | eBPF active |
| Process Agent | Running |

Custom queries: InnoDB Cluster replication lag is monitored via `performance_schema.replication_group_member_stats` (configured in `mysql.d/conf.yaml`).

Dashboard IDs: AI Efficiency → `q48-mq9-3i7`, Audit Log → `qwe-2un-us8`

### Audit Log Pipeline (Alloy → Loki → Grafana)

1. `mysql-mcp` writes JSONL audit logs to the path specified by `--audit-log <path>`
2. `mysql-mcp-exporter` reads the same file (via `AUDIT_LOG_PATH`) and exposes derived metrics on port `3000`
3. Grafana Alloy (replaces EOL Promtail) scrapes the JSONL file and pushes to Loki at `http://localhost:3100`
4. Verify in Grafana: Data Sources → Loki → Explore → run query:

```logql
{source="mysql_mcp"}
```

## Dashboard Management

Pre-configured Datadog dashboard JSONs in `examples/dashboards/`:

| File | Dashboard |
|---|---|
| `datadog-dashboard.json` | Token & Tool Metrics |
| `datadog-ai-dashboard.json` | AI Efficiency |
| `datadog-mysql.json` | MySQL Cluster Telemetry |
| `datadog-redis.json` | Redis Telemetry |

**Import**: Load `datadog` skill → use `pup` CLI for import/export.

**Backup** (environment-agnostic):
```bash
pup dashboards backup --json | jq 'del(.id)'
```

**Audit log queries in Datadog**: `source:mysql_mcp log_type:mcp_audit`

## Common Issues & Expected Log Noise

| Log Message | Source | Cause | Action |
|---|---|---|---|
| `generic:74 Bad message` | MySQL Router | TCP liveness probes from ProxySQL/healthchecks | Ignore — expected |
| Error codes 1064, 1539 | ProxySQL | Startup validation test queries | Ignore — expected |
| `cgroups v1 metrics` warnings | Datadog Agent | WSL2 cgroup compatibility | Ignore — no metric impact |
| `UDP packet routing` errors | Datadog Agent | WSL2 → Windows UDP bridge | See WSL troubleshooting in AGENT_README |
| `mysql.d check error` on startup | Datadog Agent | MySQL not yet healthy during container init | Transient — resolves after healthcheck passes |

> [!TIP]
> Most observability stack log noise originates from Docker networking on WSL2. If a message doesn't appear in this table, check the Datadog Agent container logs before escalating.

**[WHEN]** encountering unfamiliar log errors in the observability stack → **[ALWAYS]** check this table first, then load `datadog` skill for deeper diagnostics.

## Companion Skill Loading

| Skill | Load When |
|---|---|
| `datadog` | Debugging Datadog Agent, managing dashboards via `pup` CLI, interpreting custom metric queries, configuring InnoDB Cluster custom queries |
| `opentelemetry` | Standardizing `gen_ai.*` span attributes for MCP tool telemetry, configuring `db.system` attributes, OTLP exporter pipeline setup |
| `mysql-mcp-infrastructure` | Rebuilding local Docker observability stack, reseeding test data, running `recreate-ecosystem.mjs` |

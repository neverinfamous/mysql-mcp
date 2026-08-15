---
name: datadog
version: 2.0.0
tags:
  - "agent-skill"
description: |
  Use when working with Datadog: monitoring, dashboards, APM, logs, RUM, SLOs, downtimes, 
  or auth via the pup CLI.
  Triggers on: "Datadog", "DD_API_KEY", "pup", "monitors", "APM", "RUM", "SLO", "downtime".
  Do NOT trigger for generic observability/tracing without Datadog explicitly mentioned (use opentelemetry instead).
dependencies: "node>=18"
references:
  - dd-monitors
  - dd-logs
  - dd-apm
  - dd-pup
  - dd-software-delivery
  - agent-observability
---

# Datadog Skills

Unified guide for interacting with Datadog via the `pup` CLI.

<instructions>
## Security Gates (CRITICAL)

> [!CAUTION]
> **HITL GATE**: Stop and ask the user for explicit confirmation before:
> - Creating or modifying downtimes (`pup downtime create`)
> - Muting/deleting monitors
> - Any operation that modifies production alerting state
>
> **Secrets**: NEVER log, echo, or commit `DD_API_KEY` or `DD_APP_KEY`. Use env vars exclusively.

Before performing any Datadog operations via CLI, ensure the required authentication variables are set:
- **DD_API_KEY**: Datadog API key
- **DD_APP_KEY**: Datadog Application key
- **DD_SITE**: Datadog site (e.g., `datadoghq.com`, `us5.datadoghq.com`)

If any are missing or unclear, ask the user to provide them.
</instructions>

<context>
## 1. Using the `pup` CLI

Utilize the `pup` CLI for Datadog interactions.

### Command Execution Policy

1. Check context first (conversation, prior outputs, known values).
2. Run discovery commands when required values are missing.
3. Ask the user only when values remain ambiguous.
4. Run the target command after required inputs are known.
5. Avoid speculative commands likely to fail.

### Quick Reference

| Task | Command |
|------|---------|
| Search error logs | `pup logs search --query "status:error" --from 1h` |
| List monitors | `pup monitors list` |
| Schedule downtime | `pup downtime create --file downtime.json` |
| Find slow traces | `pup traces search --query "service:api @duration:>500ms" --from 1h` |
| Query metrics | `pup metrics query --query "avg:system.cpu.user{*}"` |
| Check auth | `pup auth status` |
| List dashboards | `pup dashboards list -o json` |
| Get dashboard | `pup dashboards get <id> -o json` |
| Update dashboard | `pup dashboards update <id> --file <file.json> -y` |

### Key Flags

| Flag | Purpose |
|------|---------|
| `-o json` | Output format (`json`, `table`, `yaml`, `csv`) |
| `--jq "<expr>"` | Filter output through a jq expression (applied before formatting) |
| `-y` | Auto-approve destructive operations (non-interactive) |

> [!WARNING]
> `--agent-bypass` and `--silent` are **NOT** valid pup flags. They are agent-exec interceptor flags. Do not pass them to pup.

### Setup & Auth
```bash
# Install core skills (if not already installed)
npx skills add datadog-labs/agent-skills --skill dd-pup --skill dd-monitors --skill dd-logs --skill dd-apm --full-depth -y

pup auth login          # OAuth2 (recommended)
pup auth status         # Check token
pup auth refresh        # Refresh expired token
```
**Token Expiry**: OAuth tokens expire (~1 hour). Run `pup auth refresh` if commands fail with 401/403.

## 2. Dashboard Management

### Backup Pattern
Download dashboards with a jq filter to strip API-only metadata and keep only the definition:
```powershell
pup dashboards get <id> -o json --jq "{title, description, widgets, template_variables, layout_type, notify_list, pause_auto_refresh, reflow_type}" | Out-File "dashboard.json" -Encoding utf8NoBOM
```

> [!NOTE]
> **Dashboard ID Omission**: The above `--jq` filter explicitly strips the `id` field from the JSON to make it environment-agnostic. To update an existing dashboard later, you cannot read the `id` from the file; you must query `pup dashboards list -o json` to match the `title` to its current `id`.

### Upload Pattern
```powershell
pup dashboards update <id> --file dashboard.json -y
```

> [!CAUTION]
> **`$scope` Variable Safety**: When constructing dashboard JSON programmatically (e.g., via `node -e`), the `$scope` template variable in metric queries like `avg:metric{$scope}` will be stripped by shell variable expansion (both PowerShell and the agent-exec rewriter). Use `String.fromCharCode(36) + 'scope'` in Node.js scripts, or write queries to a file first rather than inline.

## 3. Integration Configuration Anti-Patterns

### Duplicate Autodiscovery (CRITICAL)
**NEVER** combine a static `conf.d/<check>.d/conf.yaml` file AND Docker Autodiscovery labels (`com.datadoghq.ad.check_names`) for the same integration. This causes the Datadog agent to run the check **twice** per interval, generating duplicate metrics, wasting agent resources, and masking alerting signals.

**Rule**: Use Docker Autodiscovery labels exclusively for containerized services. Reserve static `conf.yaml` files only for host-level system checks (cpu, memory, disk, etc.) that have no container to attach labels to.

### OpenMetrics Endpoint Timeout
**ALWAYS** add `timeout: 10` to OpenMetrics/Prometheus scrape instances. Without it, if the target endpoint hangs, the agent check stalls indefinitely, blocking the entire check cycle.

## 4. WSL Container Agent Hardening

When running the Datadog agent in a WSL2 Docker container with full observability (APM + eBPF System Probe + Live Processes + Logs + multiple integration checks):

| Setting | Minimum | Rationale |
|---------|---------|-----------|
| `stop_grace_period` | `30s` | Agent needs time to flush pending metrics, traces, and logs during container cycling |
| `mem_limit` | `1536m` | Full-stack agent (APM + Processes + eBPF + Logs + 5+ integrations) can approach 1GB during metric spikes |
| `pid: host` | Required | Accurate process collection in WSL2 |
| `cgroupns_mode: host` | Recommended | **NOT a valid Compose property** — Docker Compose v5+ rejects it. Set `"default-cgroupns-mode": "host"` in `/etc/docker/daemon.json` instead |
| `DD_EXTRA_PERFORMANCE_METRICS` | `false` | Disable to prevent high metric ingestion costs and spam from unneeded system profiling |

Database-tier proxies (`mysql-router`, `proxysql`) that handle active connections should also use `stop_grace_period: 30s` to prevent in-flight query failures during restarts.

### Container Healthcheck Compatibility
Many observability images have moved to distroless or slim bases that break `CMD-SHELL` healthchecks:

| Image | Issue | Fix |
|-------|-------|-----|
| `grafana/loki:3.6+` | **Distroless** — no `/bin/sh`, `wget`, `grep` | `healthcheck: { disable: true }` (validate via external script) |
| `grafana/alloy:latest` | Has `/bin/sh` but no `wget`/`curl` | `grep -q ':PORT_HEX' /proc/net/tcp /proc/net/tcp6 || exit 1` |

> [!WARNING]
> Go services (Loki, Promtail, Prometheus) often bind on **IPv6 dual-stack**. Always check **both** `/proc/net/tcp` and `/proc/net/tcp6` in healthchecks, or the port won't be found.

### WSL2/Windows Inotify Log Tailing Bug (CRITICAL)

When the Datadog Agent runs in a WSL2 Docker container and uses a **volume bind-mount** to tail log files that are actively written to by a **native Windows process** (e.g., an MCP server running via `node.exe` on the Windows host):
- The Linux `inotify` subsystem **does not trigger** when the Windows host modifies the file over the 9P mount.
- The Datadog Agent's tailer will **stall indefinitely** at the file size read during container startup, and its `Bytes Read` metric will freeze.
- **Workaround:** Restart the Datadog Agent container (`docker restart datadog-unified`) to force a fresh file scan, or run the writing process natively within WSL2 so file modifications originate from the Linux kernel.

### ProxySQL and MySQL Router Expected Errors

In heavily monitored or tested environments (like those driven by MCP test suites), certain log patterns are expected and should not trigger alarms:

- **ProxySQL (`1064`, `1539`, etc.)**: ProxySQL intercepts and logs all intentional MySQL errors thrown by test suites (e.g., dropping non-existent events, syntax errors) to `stdout`. These are natively ingested by Datadog via the `com.datadoghq.ad.logs` label. You do not need to mount custom error log files; simply add a Log Stream Widget filtering on `source:proxysql status:(error OR warn)` to your dashboards.
- **MySQL Router (`generic:74 Bad message`)**: Errors like `classic::loop() processor failed: Bad message (generic:74)` are completely normal. They occur when liveness probes (like Datadog's TCP check or Docker's healthcheck) connect to the router's port and immediately disconnect without sending a valid MySQL protocol payload.

## 5. Custom Queries for InnoDB Cluster

The default Datadog MySQL integration does not track Group Replication specifics. For containerized databases, use Docker autodiscovery labels (`com.datadoghq.ad.instances`) to inject custom queries for InnoDB Cluster telemetry. **Never** combine static `conf.yaml` files with containerized databases.

Example Docker label for custom queries:

```yaml
com.datadoghq.ad.instances: |
  [
    {
      "custom_queries": [
        {
          "metric_prefix": "mysql.group_replication",
          "query": "SELECT COUNT_TRANSACTIONS_IN_QUEUE, COUNT_TRANSACTIONS_REMOTE_IN_APPLIER_QUEUE FROM performance_schema.replication_group_member_stats WHERE MEMBER_ID = @@server_uuid",
          "columns": [
            {"name": "transactions_in_queue", "type": "gauge"},
            {"name": "transactions_remote_in_applier_queue", "type": "gauge"}
          ],
          "tags": ["custom_query:group_replication_lag"]
        }
      ]
    }
  ]
```

This surfaces transaction queue backlog and applier lag, which are invisible to the default integration but critical for detecting cluster health degradation.
</context>

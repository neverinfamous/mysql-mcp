---
name: audit-metrics
description: |
  Exhaustive adversarial audit of the mysql-mcp metrics and observability pipeline — Prometheus exporter, Datadog integration, Grafana Alloy/Loki, and audit log routing.
  Use when metrics are missing, dashboards are stale, or after changes to the exporter container, audit logging, or Datadog configs.
  Do NOT use for Docker Compose hardening, script consistency, or sync workflow validation (use /infrastructure-audit instead).
disable-model-invocation: true
---

# Metrics & Observability Pipeline Audit

> **Prerequisite**: Ensure the `mysql-mcp-exporter` container is running and healthy before starting.
> Load the `/datadog` skill for `pup` CLI usage.

Run a single-pass audit against the live `mysql-mcp` ecosystem to validate the full metrics pipeline, then cross-check alignment with the `adamic` parent compose.

## 1. Audit Initialization
<phase>
<instructions>
1. Load the `/datadog` skill (`C:\Users\chris\Desktop\adamic\skills\datadog\SKILL.md`).
2. Set the target audit paths:
   - **MySQL-MCP Ecosystem**: `C:\Users\chris\Desktop\mysql-mcp\test-server\infrastructure`
   - **MySQL-MCP Examples**: `C:\Users\chris\Desktop\mysql-mcp\examples`
   - **Adamic Parent Compose**: `C:\Users\chris\Desktop\adamic\docs\unified-database-ecosystem\docker-compose.yml`
   - **Metrics Source Code**: `C:\Users\chris\Desktop\mysql-mcp\src\observability\metrics.ts`
   - **Wiki Pages**: `C:\Users\chris\Desktop\mysql-mcp.wiki\Observability.md`, `C:\Users\chris\Desktop\mysql-mcp.wiki\Test-Ecosystem.md`, `C:\Users\chris\Desktop\mysql-mcp.wiki\Audit-Trail.md`, `C:\Users\chris\Desktop\mysql-mcp.wiki\Configuration.md`
3. Verify the exporter is running:
   ```powershell
   docker ps --filter "name=mysql-mcp-exporter" --format "table {{.Names}}\t{{.Status}}"
   ```
</instructions>
</phase>

---

## Phase 1: Metrics Pipeline Audit
<phase>
Dispatch a **single `research` subagent** to audit the live mysql-mcp metrics ecosystem exhaustively.

<instructions>
**Audit Dimensions**:

### Prometheus Exporter Container
- **Volume mount**: Must map `../../logs:/var/log/mysql-mcp` (NOT `../../data`). The exporter reads the IDE's live audit JSONL from this mount.
- **Audit log path**: `--audit-log /var/log/mysql-mcp/exporter-audit.jsonl` (Must be isolated from `mcp-audit.jsonl` to prevent race conditions).
- **AUDIT_LOG_PATH env var**: Must be set to `/var/log/mysql-mcp/mcp-audit.jsonl`. This env var takes precedence over `--audit-log` in the metrics JSONL fallback reader, separating the read path (metrics aggregation) from the write path (AuditLogger).
- **--audit-reads flag**: Verify the IDE's MCP config (`C:\Users\chris\.gemini\config\mcp_config.json`) includes `--audit-reads` so read-scope tools contribute `tokenEstimate` values.
- **Healthcheck**: Must use `wget --spider -q http://127.0.0.1:3000/metrics`.
- **Resource limits**: `mem_limit: 256m`, `stop_grace_period: 30s`.
- **Logging**: `json-file` driver with `max-size: 10m`, `max-file: 3`.

### Datadog Integration Configs
- **reported_hostname**: All Datadog integration configs must use `adamic-wsl2`. Grep for stale `docker-desktop` references.
- **cgroup mode**: Datadog Agent must include `cgroup: host` (or `cgroupns_mode: host`) for native WSL2 container cgroup v2 metric collection.
- **extra_performance_metrics**: MUST be `false` (deprecated in Agent 7.81+). Do NOT set to `true`.
- **Dashboard JSON**: Widget queries must reference correct metric names and sources.
- **Datadog labels**: Verify `com.datadoghq.ad.logs` labels on exporter container match expected source/service.

### Prometheus Config
- Scrape targets in `prometheus.yml` must include the exporter (`mysql-mcp-exporter:3000`).
- Scrape interval must be appropriate (15s–60s).
- Verify no stale scrape targets for removed services.

### Grafana Alloy / Loki Pipeline
- Alloy config must strictly route ONLY `mcp-audit.jsonl` to Loki. Do NOT use wildcards (like `*-audit.jsonl`) and do NOT route `exporter-audit.jsonl` to Loki, as this is intentionally excluded to prevent log contamination.
- Alloy volume mount must be `../../logs:/var/log/mysql-mcp:ro` (read-only).
- Verify Loki labels match Grafana dashboard queries.

### Adamic Parent Compose Alignment
- Cross-check the `mysql-mcp-exporter` service in `adamic` docker-compose against the `mysql-mcp` satellite.
- Verify all env vars, volume mounts, and CLI flags are consistent (accounting for the sync script's path transformation: `../../../mysql-mcp/logs` → `../../logs`).

### MySQL-MCP Examples
- All `examples` directories (`basic-mysql-datadog`, `enterprise-ha-mysql`, and `full-observability-ecosystem`) MUST run the exporter to provide the best observability examples.
- Verify they use the correct Datadog dashboard JSON files (no dashboard ID mismatches) and reference valid image tags.

### Documentation Accuracy
- **Wiki Observability.md**: Must reference correct log file paths, exporter configuration, and `AUDIT_LOG_PATH`.
- **Wiki Test-Ecosystem.md**: Ensure references to local ports and datadog integrations remain accurate.
- **Wiki Audit-Trail.md**: Must document the `AUDIT_LOG_PATH` env var and exporter container integration.
- **Wiki Configuration.md**: Must include `AUDIT_LOG_PATH` in the environment variables table.
- **AGENT_README.md** files (both adamic and mysql-mcp infrastructure): Must document exporter audit log configuration.

**Reporting**: Do NOT make any changes. Compile a detailed list of every discrepancy, specifying the file path, line numbers, and proposed fix.
</instructions>
</phase>

---

## Phase 2: Live Metrics Validation
<phase>
<instructions>
After the audit subagent reports, perform live validation:

1. **Scrape the Prometheus endpoint**:
   ```powershell
   docker exec mysql-mcp-exporter wget -q -O - http://127.0.0.1:3000/metrics
   ```
   Verify these metric families have non-zero values:
   - `mysql_mcp_tool_calls_total` — at least several tools with calls > 0
   - `mysql_mcp_tool_tokens_total` — at least several tools with tokens > 0
   - `mysql_mcp_tool_duration_seconds` — latency percentiles populated
   - `mysql_mcp_tool_tokens_per_call` — derived gauge populated

2. **Verify container sees correct file**:
   ```powershell
   docker exec mysql-mcp-exporter ls -la /var/log/mysql-mcp/mcp-audit.jsonl
   ```
   File must be > 1 MB and recently modified (not stale).

3. **Query Datadog** (requires `/datadog` skill):
   ```powershell
   pup metrics query --query "sum:mysql_mcp.mysql_mcp_tool_calls.count{*}" --from 1h
   ```
   > [!NOTE]
   > Datadog automatically translates Prometheus `_total` suffixes into `.count`. Therefore, a metric exported as `mysql_mcp_tool_calls_total` must be queried in Datadog as `mysql_mcp.mysql_mcp_tool_calls.count`.
   Verify data points are being ingested.

4. **Check Prometheus scrape health**:
   ```powershell
   docker exec prometheus wget -q -O - "http://localhost:9090/api/v1/targets" 2>&1 | Select-String "mysql-mcp-exporter"
   ```
   Target must show `state: "up"`.
</instructions>
</phase>

---

## Phase 3: Truth-Finding & Planning
<phase>
<instructions>
1. **Triage findings** from Phase 1 audit and Phase 2 live validation:
   - 🔴 **Critical**: Metrics not ingesting, wrong file paths, broken scrape targets
   - 🟡 **Medium**: Documentation drift, stale dashboard widgets, missing env var docs
   - 🔵 **Info**: Cosmetic issues, style inconsistencies
2. **Create implementation plan** (`implementation_plan.md` artifact) with:
   - Summary of findings by severity
   - Detailed file-by-file fix list
   - Verification commands

Once the plan is created, STOP and wait for explicit user approval before proceeding to execution. Once the user approves the plan, do NOT stop again before committing. Any changes made should be immediately committed (though you must stop again before running the `/recreate-global-ecosystem` workflow if applicable).
</instructions>
</phase>

---

## Phase 4: Execution
<phase>
<instructions>
1. **Apply fixes** using `replace_file_content` / `multi_replace_file_content` for all edits.
2. **Validate compose** after docker-compose changes:
   ```powershell
   wsl bash -c "cd /mnt/c/Users/chris/Desktop/mysql-mcp/test-server/infrastructure; docker compose config --quiet"
   ```
3. **Rebuild or Restart containers** if docker-compose or source code changed:
   > [!CAUTION]
   > **STOP for HITL Approval**: Do NOT run the `/recreate-global-ecosystem` workflow until the user explicitly approves.

   - If the modified container is integrated or affects database topology (e.g., `mysql-mcp-exporter`, `datadog-unified`, proxies, or db nodes), you MUST use the `/recreate-global-ecosystem` workflow by running its master script. Do NOT use `docker compose up` directly, as hot-reloading can break the InnoDB Cluster quorum.
   - ONLY if the container is completely isolated (e.g., `dozzle` or `adminer`), you may restart it separately:
     ```powershell
     docker compose -f test-server/infrastructure/docker-compose.yml up -d --build <container_name> --no-deps
     ```
4. **Re-validate metrics** using the same scrape commands from Phase 2.

> [!CAUTION]
> **Never make edits via script.** All edits must exclusively use the native file editing tools (`replace_file_content` / `multi_replace_file_content`).

> [!IMPORTANT]
> **NO VALIDATION REQUIRED FOR DOCS (OVERRIDES GLOBAL RULES)**: Run lint/typecheck only for code changes. For Docker compose or script changes, validate with `docker compose config`.
</instructions>
</phase>

---

## Phase 5: Committing
<phase>
<instructions>
Once verified:

> [!NOTE]
> Do NOT require another/separate confirmation to commit the changes. Commit immediately.

1. Commit `mysql-mcp` changes using the enforced commit wrapper with targeted paths.
2. Commit `adamic` changes using the enforced commit wrapper with targeted paths (if parent compose was modified).
3. Kill all subagents to free resources.
4. Present final walkthrough artifact summarizing all changes.
</instructions>
</phase>

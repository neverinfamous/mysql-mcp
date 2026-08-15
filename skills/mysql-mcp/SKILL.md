---
name: mysql-mcp
version: 1.0.0
tags:
  - "agent-skill"
description: |
  Core guidelines and instruction pointers for the mysql-mcp server. Use when interacting with the mysql-mcp server, configuring tool filtering, using Code Mode (mysql_execute_code), setting up database infrastructure, configuring observability, recovering from failures, or when you need to review its tools and architecture.
  Triggers on: "mysql-mcp", "mysql_execute_code", "Code Mode", "tool filtering", "mysql://help", "database setup", "observability stack", "InnoDB Cluster setup", "mysql-mcp examples".
  Do NOT trigger for generic MySQL queries without MCP context (use `mysql` skill instead).
  Do NOT trigger for Docker infrastructure teardown/rebuild (use `mysql-mcp-infrastructure` skill instead).
references:
  - mysql
  - mysql-mcp-infrastructure
  - datadog
  - opentelemetry
  - mysql-router
  - mysqlsh
  - proxysql
---

# MySQL MCP Server Guidelines

The `mysql-mcp` server provides specialized tools, a Code Mode sandbox, audit logging, and a full observability pipeline. This skill is the **orchestration hub** — it routes agents to the right resource at the right time without duplicating content that lives in the server's own help system or companion skills.

## 1. Foundational Ecosystem

The `mysql-mcp` server operates within a broader skill ecosystem. **Do not guess domain-specific rules — load the companion skill when needed:**

| Skill | Load When | Provides |
|---|---|---|
| **`mysql`** | Writing SQL, schema design, MySQL 9.0+ features (Vector, JSON) | Engine production rules, parameterization, `STRICT_TRANS_TABLES`, ProxySQL multiplexing anti-patterns, `VECTOR` data type syntax |
| **`mysql-mcp-infrastructure`** | Tearing down, rebuilding, or reseeding the local Docker test ecosystem | HITL-gated lifecycle scripts (`recreate-ecosystem.mjs`, `reset-database.mjs`), Docker Compose standards |
| **`datadog`** | Debugging Datadog Agent, managing dashboards, interpreting InnoDB Cluster custom queries | `pup` CLI, custom YAML queries for Group Replication lag, expected proxy log noise, WSL agent configuration |
| **`opentelemetry`** | Instrumenting MCP tool telemetry, configuring span attributes | `gen_ai.*` semantic conventions, `db.system` attributes, OTLP pipeline |
| **`mysql-router`** | Working with MySQL Router or configuring cluster HA routing | Bootstrap mechanics, routing strategies, REST API monitoring, connection sharing |
| **`mysqlsh`** | Using MySQL Shell, AdminAPI, or dump/load utilities | InnoDB Cluster management (`dba`), parallel dump/load (`util.*`), Upgrade Checker |
| **`proxysql`** | Working with ProxySQL, connection multiplexing, or query routing | 3-layer config (MEMORY/RUNTIME/DISK), query rules, caching, firewalling |

## 2. Context & Architecture Recovery

**\[WHEN\]** you need to understand the server architecture, available tool categories, configuration, or Code Mode mechanics -> **\[ALWAYS\]** read the Code Map:
- `C:\Users\chris\Desktop\mysql-mcp\test-server\code-map.md`

**\[WHEN\]** you need specific tool schemas, argument requirements, or usage examples -> **\[ALWAYS\]** read the Tool Reference:
- `C:\Users\chris\Desktop\mysql-mcp\test-server\tool-reference.md`

**\[WHEN\]** you need project-level overview, build commands, or quality gates -> **\[ALWAYS\]** read the Project README:
- `C:\Users\chris\Desktop\mysql-mcp\AGENT_README.md`

**\[WHEN\]** you need test ecosystem topology, port mappings, or WSL troubleshooting -> **\[ALWAYS\]** read the Infrastructure README:
- `C:\Users\chris\Desktop\mysql-mcp\test-server\infrastructure\AGENT_README.md`

**\[WHEN\]** you need to update or modify the core server instructions -> **\[ALWAYS\]** edit the source markdown files in `src/constants/instructions/markdown/` and run the generation script:
- `C:\Users\chris\Desktop\mysql-mcp\scripts\generate-server-instructions.ts`

**\[WHEN\]** you need pre-configured Docker stacks for database setup -> **\[ALWAYS\]** check the examples directory:
- `C:\Users\chris\Desktop\mysql-mcp\examples`

## 3. Infrastructure Selection & Setup

**\[WHEN\]** a user asks about database setup, getting started, or connecting `mysql-mcp` to a database -> **\[ALWAYS\]** assess their needs against this matrix before recommending a path:

| Need | Recommended Setup | Key Details |
|---|---|---|
| Quick local dev / single MySQL | `examples/basic-mysql-datadog` | Single MySQL 9.x + Datadog Agent. Simplest path. |
| HA cluster testing | `examples/enterprise-ha-mysql` | 3-node Group Replication + Router + ProxySQL + Datadog. Run `init-cluster.sh` after `docker compose up -d`. |
| Full observability stack | `examples/full-observability-ecosystem` | Enterprise HA + Redis + Prometheus + Grafana + Loki + Alloy + Dozzle + Adminer + Exporter + Datadog. |
| Internal `mysql-mcp` development | `test-server/infrastructure/` | Load **`mysql-mcp-infrastructure`** skill for lifecycle scripts. |
| Managed cloud database (RDS/Cloud SQL/Azure) | Direct `MYSQL_*` env vars | No Docker needed. Use `--tool-filter starter` to exclude cluster tools. |

> See [`references/ecosystem-setup-guide.md`](references/ecosystem-setup-guide.md) for MCP client configuration templates, port reference tables, default credentials, and cloud database connection guidance.

**Setup flow for Docker-based examples:**
1. `cp .env.example .env` and edit credentials / `DD_API_KEY`
2. `docker compose up -d`
3. For HA setups: run `init-cluster.sh` and wait for cluster bootstrap
4. Configure MCP client with the appropriate `MYSQL_HOST`/`MYSQL_PORT` (see reference guide)

## 4. Operational Directives

- **Runtime Configuration & Lifecycle**: The server exposes an `update_configuration` tool. **[CRITICAL]** Configuration changes do NOT apply immediately; you **MUST** restart the server. "Restarting the server" means restarting the local Node process, NEVER the underlying database or Docker infrastructure. To restart the Node process cleanly and quickly apply code changes, **[ALWAYS]** execute `bun .\.agents\scripts\restart-mcp.ts mysql-mcp`. This script will automatically perform a fast JS build, kill stuck processes, and force the Antigravity IDE to resurrect the server. **[NEVER]** attempt to use `process.exit(0)` directly as it causes permanent IDE client connection drops.

- **Code Mode Priority**: **\[ALWAYS\]** prefer using `mysql_execute_code` (Code Mode) for multi-step database operations to dramatically reduce token overhead (70-90% savings). Access all tools via the `mysql.*` namespace inside the sandbox.
- **Code Mode Safety**: Code Mode does **NOT** bypass destructive-operation safety gates. `DROP`, `TRUNCATE`, `DELETE` without `WHERE`, and `ALTER TABLE ... DROP COLUMN` executed inside Code Mode scripts MUST still require explicit user confirmation before the script is submitted.
- **Tool Filtering**: Due to IDE limits, you cannot load all tools at once. **\[ALWAYS\]** use tool filtering (e.g., `--tool-filter starter` or `--tool-filter codemode`) when deploying or instructing the user on setup.
- **Connection Safety**: **\[ALWAYS\]** respect strict schema configurations (like `STRICT_TRANS_TABLES`) and use parameterized queries, even when executing scripts within Code Mode. Load the **`mysql`** skill for engine-specific production rules.

- **MySQL Version Awareness**: **\[WHEN\]** using vector tools (`mysql_vector_*`) -> **\[ALWAYS\]** verify the target database is MySQL 9.0+ (9.1+ required for HNSW indexes). **\[WHEN\]** writing SQL that uses `VECTOR` data type or `VECTOR_DISTANCE()` -> **\[ALWAYS\]** load the **`mysql`** skill for MySQL 9.0+ syntax rules.

- **Server Instructions Architecture**: The server uses a two-tier on-demand instruction system. A slim base payload is auto-injected at init. Group-specific help is served lazily via `mysql://help/{group}` resources. There are many group help resources plus `mysql://help` (gotchas). The server instructions own tool-level mechanics (parameter aliases, pagination defaults, error codes). This skill owns orchestration and cross-cutting concerns.

## 5. Telemetry & Observability

### Verification Flow

**\[WHEN\]** verifying database health or telemetry pipeline -> **\[ALWAYS\]** follow this sequence:

1. **MCP Resource first**: Read `mysql://health` for immediate database status
2. **Internal metrics**: Read `mysql://metrics` for tool invocation counts, error rates, and token estimates
3. **Datadog (if configured)**: Query `mysql.net.connections`, `mysql.innodb.buffer_pool_utilization` via the Datadog MCP server
4. **Local Prometheus**: Query `http://localhost:9090/api/v1/query` for time-series analysis

### Stack Components

| Component | URL | Purpose |
|---|---|---|
| Prometheus | `http://localhost:9090` | Time-series metrics scraping |
| Grafana | `http://localhost:3001` | Pre-loaded dashboards (admin/admin) |
| mysql-mcp-exporter | `http://localhost:3000` | MCP audit log metrics |
| Datadog Agent | `docker exec datadog-unified agent status` | Host metrics, APM, eBPF, DB integrations |
| Loki | `http://localhost:3100` | Log aggregation |
| Grafana Alloy | `http://localhost:12345` | Log collector (replaces Promtail) |
| Dozzle | `http://localhost:8080` | Container log viewer |

### Dashboard Management

Pre-configured Datadog dashboard JSONs are available in `examples/dashboards/`:
- `datadog-dashboard.json` — Token & Tool Metrics
- `datadog-ai-dashboard.json` — AI Efficiency
- `datadog-mysql.json` — MySQL Cluster Telemetry
- `datadog-redis.json` — Redis Telemetry

**\[WHEN\]** managing dashboards -> **\[ALWAYS\]** load the **`datadog`** skill for `pup` CLI import/export commands.

> See [`references/observability-guide.md`](references/observability-guide.md) for detailed verification workflows, expected log noise reference, and troubleshooting steps.

## 6. Recovery & Troubleshooting

**\[WHEN\]** test database data is corrupted or stale -> **\[ALWAYS\]** run:
```
node test-server/infrastructure/scripts/reset-database.mjs
```
This is a safe, non-destructive reseed operation.

**\[WHEN\]** InnoDB Cluster quorum is lost or primary is stuck in `super_read_only` -> **\[ALWAYS\]** run:
```
node test-server/infrastructure/scripts/heal-primary.mjs
```

**\[WHEN\]** full ecosystem rebuild is needed (containers destroyed, config drift) -> **\[ALWAYS\]** load the **`mysql-mcp-infrastructure`** skill. Teardown requires HITL confirmation.

**\[WHEN\]** WSL2/Docker issues (idle timeouts, containers not starting) -> **\[ALWAYS\]** check the Infrastructure README for:
- WSL keep-alive scheduled task (`WSL-KeepAlive`)
- Crash diagnostics (`dmesg`, `journalctl --list-boots`)
- Docker service status (`systemctl status docker`)

**\[WHEN\]** encountering unfamiliar log errors from Router/ProxySQL/Datadog -> **\[ALWAYS\]** check the observability guide's expected noise table before escalating. See [`references/observability-guide.md`](references/observability-guide.md).

## 7. Testing Infrastructure Directives

**\[CRITICAL\]** When working on the `mysql-mcp` codebase itself, manual editing of the generated markdown test files in `test-usability/`, `test-usability-direct/`, `test-advanced/`, and `test-tool-groups/` is **STRICTLY FORBIDDEN**.
**\[ALWAYS\]** make modifications through `scripts/test-manifest.ts` or the `scripts/content/*.content.md` partials, which act as the single source of truth for the test generation engine.

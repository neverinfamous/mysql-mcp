# Ecosystem Setup Guide

## Environment Prerequisites

- **Node.js 20+** — required runtime for `mysql-mcp`
- **pnpm** — package manager (`npm i -g pnpm`)
- **Docker** — native `docker-ce` on WSL2 Ubuntu or Docker Desktop
- **mysql-mcp** — install via `npx mysql-mcp` or clone the repo locally

> [!IMPORTANT]
> The current dev environment runs native `docker-ce` inside WSL2 Ubuntu 24.04 — Docker Desktop is NOT installed. All `docker compose` commands execute within the WSL2 distro.

## Setup Decision Tree

| Need | Recommended Setup | Key Files |
|---|---|---|
| Quick local dev / single MySQL | `examples/basic-mysql-datadog` | `docker-compose.yml`, `.env.example` |
| HA cluster testing | `examples/enterprise-ha-mysql` | `docker-compose.yml`, `init-cluster.sh`, `config/` |
| Full observability stack | `examples/full-observability-ecosystem` | `docker-compose.yml`, `config/` (alloy, grafana, prometheus, etc.) |
| Internal `mysql-mcp` development | `test-server/infrastructure/` | Load `mysql-mcp-infrastructure` skill |
| Managed cloud database (RDS/Cloud SQL/Azure) | Direct `MYSQL_*` env vars | See [§ Cloud Database](#cloud--managed-database-connection) |

### Setup Flow (all Docker-based stacks)

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit credentials (or use defaults for local dev)
$EDITOR .env

# 3. Start services
docker compose up -d

# 4. Verify health
docker compose ps          # all containers "healthy"
docker compose logs -f     # watch for startup errors
```

**`enterprise-ha-mysql` extra step** — after containers are healthy, run `init-cluster.sh` to bootstrap the InnoDB Cluster and configure ProxySQL/Router routing.

## MCP Client Configuration Templates

### Claude Desktop / Cursor

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["-y", "mysql-mcp", "--tool-filter", "starter", "--audit-log", "mcp-audit.jsonl", "--audit-reads"],
      "env": {
        "MYSQL_HOST": "127.0.0.1",
        "MYSQL_PORT": "3307",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "mysqlmcp",
        "MYSQL_DATABASE": "mysqlmcp",
        "MYSQL_XPORT": "33060"
      }
    }
  }
}
```

### Antigravity

Same structure — file location: `%USERPROFILE%\.gemini\antigravity\mcp_config.json`

> [!TIP]
> **Which port to use in `MYSQL_PORT`:**
> - `3307` — direct primary node (simplest, single-node setups)
> - `6033` — ProxySQL data port (recommended for HA — automatic R/W + R/O routing)
> - `6446` — MySQL Router R/W port (alternative HA entry point)

## Port Reference

| Service | Port | Purpose |
|---|---|---|
| MySQL Primary (node1) | 3307 | Direct primary access |
| MySQL Secondary (node2) | 3308 | Direct secondary access |
| MySQL Secondary (node3) | 3309 | Direct secondary access |
| MySQL Async Replica | 3310 | Read replica (parent ecosystem only) |
| ProxySQL Data | 6033 | R/W + R/O query routing (recommended MCP entry) |
| ProxySQL Admin | 6032 | ProxySQL admin interface |
| MySQL Router R/W | 6446 | Router read-write port |
| MySQL Router R/O | 6447 | Router read-only port |
| MySQL Router X-RO | 6448 | Router X Protocol read-only |
| MySQL Router REST | 8443 | Router REST management API |
| Redis | 6379 | Rate limiting & test isolation |
| Grafana | 3001 | Dashboards (admin/admin) |
| Prometheus | 9090 | Metrics collection |
| mysql-mcp-exporter | 3000 | MCP audit log metrics |
| Loki | 3100 | Log aggregation |
| Grafana Alloy | 12345 | Log collector (replaces Promtail) |
| Dozzle | 8080 | Container log viewer |
| Adminer | 8081 | Database web UI |
| MySQL Shell | 33060 | X Protocol / AdminAPI |

## Credential Reference

| Stack | User | Password | Database | Notes |
|---|---|---|---|---|
| basic-mysql-datadog | `root` | `mysqlmcp` | `mysqlmcp` | Single-node default |
| enterprise-ha-mysql | `root` | `mysqlmcp` | `mysqlmcp` | Cluster root |
| enterprise-ha-mysql | `cluster_admin` | `cluster_admin` | — | InnoDB Cluster admin |
| enterprise-ha-mysql | `mcp_user` | `mcp_password` | `mysqlmcp` | Application user |
| ProxySQL Admin | `admin` | `admin` | — | Port 6032 |
| test-server | `root` | `mysqlmcp` | `mysqlmcp` | Internal dev |

> [!CAUTION]
> **[CRITICAL]** These are test/development credentials ONLY. **[NEVER]** use in production. Rotate all passwords and restrict network access before any non-local deployment.

## Cloud / Managed Database Connection

**[WHEN]** connecting to a managed MySQL service → **[ALWAYS]** set `MYSQL_*` env vars directly; skip Docker stacks entirely.

### AWS RDS / Aurora

- `MYSQL_HOST` → RDS endpoint (e.g., `mydb.xxxx.us-east-1.rds.amazonaws.com`)
- `MYSQL_PORT` → `3306`
- `MYSQL_SSL` → `true` (RDS requires SSL by default; the `mysql2` driver handles certificate validation via `ssl: { rejectUnauthorized: true }`)

### GCP Cloud SQL

- Preferred: run `cloud-sql-proxy` locally → connect via `localhost:3306`
- Alternative: use instance public IP with SSL certificates

### Azure Database for MySQL

- `MYSQL_HOST` → `<server>.mysql.database.azure.com`
- `MYSQL_USER` → `<user>@<server>`
- `MYSQL_SSL` → `true`

> [!IMPORTANT]
> Managed databases do NOT support InnoDB Cluster / Group Replication tools. ProxySQL and Router ecosystem tools are not applicable. Use `--tool-filter starter` to load only single-instance tools.

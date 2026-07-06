# MySQL MCP Server

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Coverage](https://img.shields.io/badge/Coverage-90.06%25-green.svg) ![E2E](https://img.shields.io/badge/E2E-471%20passing%20%C2%B7%200%20skipped-blue.svg)](https://opensource.org/licenses/MIT)

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/mysql-mcp/blob/main/CHANGELOG.md)** • **[Security](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## 💎 Value Proposition

- **Execute complex logic via Code Mode**, reducing token usage by 70-90%.
- **Build AI integrations instantly**.
- **Empower agents with secure database access**.
- **Scale operations with robust connection pooling**.
- **Leverage OAuth 2.1** for enterprise security.

## 🎯 Core Benefits

| Feature                               | Description                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specialized Tools**                 | Access 200+ specialized tools. Manage core CRUD, JSON, spatial data, document stores, and clusters. |
| **23 Resources**                     | Monitor schema, performance metrics, process lists, replication status, and InnoDB diagnostics in real-time. |
| **19 AI-Powered Prompts**            | Execute guided workflows for query building, schema design, performance tuning, and infrastructure setup. |
| **Code Mode**                         | Execute operations locally inside a V8 isolate. Reduce LLM token overhead by 70-90%. |
| **Token-Optimized Payloads**          | Maximize token efficiency. Use optional flags to reduce response size for large payloads. |
| **OAuth 2.1 Security**                | Enforce granular access control with RFC compliance, strict scopes, and Keycloak integration. |
| **Smart Tool Filtering**              | Use 28 tool groups and 16 shortcuts to stay within IDE tool limits. |
| **Dual HTTP Transport**               | Support modern streamable HTTP and legacy SSE clients simultaneously with full session management. |
| **Connection Pooling**                | Leverage built-in connection pooling for efficient, highly concurrent database access. |
| **Ecosystem Integrations**            | Manage MySQL Router, ProxySQL, and MySQL Shell utilities directly from your agent. |
| **Advanced Encryption**               | Enforce TLS/SSL connections. Manage data masking, encryption monitoring, and compliance effortlessly. |
| **Production-Ready Security**         | Prevent SQL injection with parameterized queries. Rely on strict input validation and audit logging. |
| **Deterministic Errors**              | Receive structured responses with actionable suggestions. Eliminate silent failures and raw exceptions. |
| **Strict TypeScript**                 | Deploy a 100% type-safe codebase backed by over 2100 tests and high coverage. |
| **Protocol Compliant**                | Support MCP 2024-11-05 with tool safety hints, resource priorities, and progress notifications. |

---

## 🚀 Deploy in Minutes

### Meet Prerequisites

- Docker or Docker Desktop
- MySQL 5.7, 8.0+, or 9.x (supported with limitations regarding Shell driver versions) server

> **Linux Users:** If using `host.docker.internal` on Linux, you may need to run your container with `--add-host host.docker.internal:host-gateway`.

### Install the Server

#### Docker (Recommended)

> **Note on Namespaces:** The Docker image uses the `writenotenow` namespace (`writenotenow/mysql-mcp`), whereas the GitHub repository and NPM package use `neverinfamous` (`@neverinfamous/mysql-mcp`).

```bash
docker run -i --rm writenotenow/mysql-mcp:latest \
  --transport stdio \
  --mysql mysql://user:password@host.docker.internal:3306/database
```

---

## ⚡ Maximize Efficiency with Code Mode

Code Mode reduces token usage by 70-90%. It is included by default.

Code executes in a **C++ V8 isolate sandbox**. It uses a physically separate V8 isolate via `isolated-vm`. It enforces strict heap limits and synchronous termination guarantees. We map all `mysql.*` API calls through the boundary using native wrappers. This provides:

- **Strict Isolate Boundary** — prevents native object cross-talk. It eliminates prototype pollution vectors entirely since objects cannot cross the boundary.
- **29 blocked patterns** — static regex rules blocking `require()`, `process`, `eval()`, filesystem/network access, and system commands, enforced after NFKC normalization and comment stripping.
- **RPC Quotas** — strict cap of 100 API calls per execution to prevent unbounded loops.
- **Egress boundary enforcement** — result serialization aborted mid-flight when exceeding configurable limit (default 100KB)
- **Rate limiting** — 60 executions per minute per client, distributed via Redis (if `REDIS_URL` is set) with graceful in-memory fallback
- **Readonly enforcement** — when `readonly: true`, write methods return structured errors instead of executing
- **Hard timeouts** — synchronous engine-level termination if execution exceeds the fixed 30-second hard limit (not configurable)
- **Full API access** — all 28 tool groups are available via `mysql.*` (e.g., `mysql.core.readQuery()`, `mysql.json.extract()`)

### ⚡ Run Only Code Mode

Run with **only Code Mode enabled**. A single tool provides full capability access:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "MYSQL_HOST",
        "-e", "MYSQL_PORT",
        "-e", "MYSQL_USER",
        "-e", "MYSQL_PASSWORD",
        "-e", "MYSQL_DATABASE",
        "-e", "REDIS_URL",
        "writenotenow/mysql-mcp:latest",
        "--transport",
        "stdio",
        "--tool-filter",
        "codemode"
      ],
      "env": {
        "MYSQL_HOST": "host.docker.internal",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "REDIS_URL": "redis://localhost:6379"
      }
    }
  }
}
```

This exposes just `mysql_execute_code`. Agents write JavaScript against the typed SDK. They compose queries and chain operations across 28 groups. They return exactly the needed data in one execution. This mirrors the [Code Mode pattern](https://blog.cloudflare.com/code-mode-mcp/). It ensures fixed token costs.

> [!TIP]
> **Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using mysql-mcp, prefer `mysql_execute_code` (Code Mode) for multi-step database operations to minimize token usage."_
>
> For maximum savings, use `--tool-filter codemode` to run with Code Mode as your only tool. See the [Code Mode wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Code-Mode) for full API documentation.

---

## ⚡ Configure Your MCP Client

### Cursor IDE / Claude Desktop

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "writenotenow/mysql-mcp:latest",
        "--transport",
        "stdio",
        "--mysql",
        "mysql://user:password@host.docker.internal:3306/database"
      ]
    }
  }
}
```

### Using Environment Variables (Recommended)

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "MYSQL_HOST",
        "-e", "MYSQL_PORT",
        "-e", "MYSQL_USER",
        "-e", "MYSQL_PASSWORD",
        "-e", "MYSQL_DATABASE",
        "-e", "MYSQL_XPORT",
        "writenotenow/mysql-mcp:latest",
        "--transport",
        "stdio"
      ],
      "env": {
        "MYSQL_HOST": "host.docker.internal",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database",
        "MYSQL_XPORT": "33060"
      }
    }
  }
}
```

> **Note:** `MYSQL_XPORT` (X Protocol port) defaults to `33060` if omitted. Only needed for `mysqlsh_import_json` and `docstore` tools. Set to your MySQL Router X Protocol port (e.g., `6448`) when using InnoDB Cluster.

> **📖 See the [Configuration Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Configuration)** for more configuration options.

### Connect via HTTP/SSE Server

> **When to use HTTP mode:** Deploy `mysql-mcp` as a standalone server. Multiple clients can connect remotely. Use `stdio` mode for local development.

**Use cases for HTTP mode:**

- Run the server in a network-accessible Docker container
- Deploy to cloud platforms (AWS, GCP, Azure)
- Enable OAuth 2.1 authentication for enterprise security
- Share one database connection across multiple AI clients

```bash
docker run --rm -p 3000:3000 \
  writenotenow/mysql-mcp:latest \
  --transport http --server-host 0.0.0.0 --port 3000 --mysql "mysql://user:pass@host.docker.internal:3306/db"
```

### Security Features & Utility Endpoints

For detailed configuration on HTTP mode, CORS, Rate Limiting, and OAuth 2.1 setup (with Keycloak), see the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth).

---

## 🔗 Connect to Any Database

| Scenario                  | Host to Use               | Example Connection String                        |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **MySQL on host machine** | `host.docker.internal`    | `mysql://user:pass@host.docker.internal:3306/db` |
| **MySQL in Docker**       | Container name or network | `mysql://user:pass@mysql-container:3306/db`      |
| **Remote/Cloud MySQL**    | Hostname or IP            | `mysql://user:pass@db.example.com:3306/db`       |

> **Tip:** For remote connections, ensure your MySQL server allows connections from Docker's IP range and that firewalls/security groups permit port 3306.

---

## 🛠️ Optimize Limits with Tool Filtering

> **Architectural Rule:** Tool filtering allows skipping the `--mysql connection` configuration if only ecosystem tools (`router`, `proxysql`, `shell`) are used.

> [!IMPORTANT]
> **AI IDEs like Cursor have tool limits (typically 40-50 tools).** With 200+ tools available, you MUST use tool filtering to stay within your IDE's limits. 
> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for the complete list of available groups and predefined bundles.

---

### CLI Options

| Option                    | Environment Variable    | Description                                         |
| ------------------------- | ----------------------- | --------------------------------------------------- |
| `--config`, `-c`          | —                       | Configuration file path (.yaml or .json)            |
| `--dump-config`           | —                       | Dump current configuration to stdout and exit       |
| `--transport`, `-t`       | —                       | Transport type: stdio, http, sse (default: stdio)   |
| `--port`, `-p`            | `MYSQLMCP_PORT`         | HTTP port for http/sse transports                   |
| `--server-host`           | `MCP_HOST`              | Host to bind HTTP transport to (default: localhost) |
| `--mysql`, `-m`           | —                       | MySQL connection string                             |
| `--mysql-host`            | `MYSQL_HOST`            | MySQL host                                          |
| `--mysql-port`            | `MYSQL_PORT`            | MySQL port                                          |
| `--mysql-user`            | `MYSQL_USER`            | MySQL username                                      |
| `--mysql-password`        | `MYSQL_PASSWORD`        | MySQL password                                      |
| `--mysql-database`        | `MYSQL_DATABASE`        | MySQL database name                                 |
| `--pool-size`             | `MYSQL_POOL_SIZE`       | Connection pool size (default: 10)                  |
| `--pool-min`              | `MYSQL_POOL_MIN`        | Minimum connections in pool (default: 0)            |
| `--pool-timeout`          | —                       | Connection acquire timeout in ms (default: 30000)   |
| `--pool-queue-limit`      | —                       | Queue limit for waiting requests (default: 0)       |
| `--tool-filter`, `-f`     | `TOOL_FILTER`           | Tool filter string                                  |
| `--name`                  | —                       | Server name                                         |
| `--auth-token`            | `MCP_AUTH_TOKEN`        | Simple bearer token for HTTP authentication         |
| `--stateless`             | —                       | Enable stateless HTTP mode (no sessions, no SSE)    |
| `--trust-proxy`           | `TRUST_PROXY`           | Trust X-Forwarded-For for client IP                 |
| `--enable-hsts`           | `MCP_ENABLE_HSTS`       | Enable HTTP Strict Transport Security               |
| `--metrics-export`        | `MCP_METRICS_EXPORT`    | Enable prometheus metrics endpoint                  |
| `--log-level`             | `LOG_LEVEL`             | Log level: debug, info, warn, error                 |
| `--allowed-io-roots`      | `ALLOWED_IO_ROOTS`      | JSON array or comma list of allowed paths for HTTP/SSE and shell tools |
| `--audit-log`             | `AUDIT_LOG_PATH`        | Path to the audit log file                          |
| `--audit-backup`          | —                       | Enable pre-mutation snapshots                       |
| `--audit-reads`           | —                       | Include read-scope tool calls in the audit log      |
| `--audit-redact`          | —                       | Redact sensitive arguments in the audit log         |
| `--audit-log-max-size`    | —                       | Max file size before rotation (bytes)               |
| `--audit-backup-data`     | —                       | Include sample data in pre-mutation snapshots       |
| `--audit-backup-max-size` | —                       | Max table size in bytes for data capture            |
| `--oauth-enabled`, `-o`   | `OAUTH_ENABLED`         | Enable OAuth 2.1 authentication                     |
| `--oauth-issuer`          | `OAUTH_ISSUER`          | Authorization server URL                            |
| `--oauth-audience`        | `OAUTH_AUDIENCE`        | Expected token audience                             |
| `--oauth-jwks-uri`        | `OAUTH_JWKS_URI`        | JWKS URI (auto-discovered)                          |
| `--oauth-clock-tolerance` | `OAUTH_CLOCK_TOLERANCE` | Clock tolerance in seconds                          |
| —                         | `MYSQL_ROUTER_URL`      | MySQL Router URL                                    |
| —                         | `MYSQL_ROUTER_USER`     | MySQL Router user                                   |
| —                         | `MYSQL_ROUTER_PASSWORD` | MySQL Router password                               |
| —                         | `MYSQL_ROUTER_INSECURE` | Bypass Router TLS verification                      |
| —                         | `PROXYSQL_HOST`         | ProxySQL host                                       |
| —                         | `PROXYSQL_PORT`         | ProxySQL port                                       |
| —                         | `PROXYSQL_USER`         | ProxySQL user                                       |
| —                         | `PROXYSQL_PASSWORD`     | ProxySQL password                                   |
| —                         | `MYSQLSH_PATH`          | Path to MySQL Shell executable                      |
| —                         | `MYSQL_XPORT`           | MySQL X Protocol port (default 33060)               |
| —                         | `CODEMODE_ISOLATION`    | Code mode isolation level                           |
| —                         | `CODE_MODE_MAX_RESULT_SIZE` | Max Code Mode result payload in bytes               |
| —                         | `METADATA_CACHE_TTL_MS` | Cache TTL for schema metadata                       |
| —                         | `REDIS_URL`             | Redis connection URL (used for rate limiting)       |
| —                         | `MCP_REQUEST_TIMEOUT`   | Global request timeout in ms (default 30000)        |
| —                         | `MCP_HEADERS_TIMEOUT`   | Global headers timeout in ms (default 5000)         |

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

### Scopes

| Scope                    | Access Level                        |
| ------------------------ | ----------------------------------- |
| `read`                   | Read-only queries (SELECT, EXPLAIN) |
| `write`                  | Read + write operations             |
| `admin`                  | Full administrative access          |
| `full`                   | Grants all access                   |
| `db:{name}`              | Access to specific database         |
| `schema:{name}`          | Access to specific schema           |
| `table:{schema}:{table}` | Access to specific table            |

> **📖 See the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth)** for Keycloak setup and detailed configuration.

---

## Contributing & Security

[Contributing Guidelines](https://github.com/neverinfamous/mysql-mcp/blob/main/CONTRIBUTING.md) • [Security Policy](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md) • [MIT License](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) • [Code of Conduct](https://github.com/neverinfamous/mysql-mcp/blob/main/CODE_OF_CONDUCT.md)

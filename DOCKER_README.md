# MySQL MCP Server (mysql-mcp)

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT) ![Coverage](https://img.shields.io/badge/Coverage-88.12%25-green.svg) ![E2E](https://img.shields.io/badge/E2E-395%20passing%20%C2%B7%200%20skipped-blue.svg)

> **Note:** Docker Hub limits descriptions to 25k characters. Some documentation may be truncated. View the **[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** or the [GitHub README](https://github.com/neverinfamous/mysql-mcp) for complete details.

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/mysql-mcp/blob/main/CHANGELOG.md)** • **[Security](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## 💎 Value Proposition

Production-ready MySQL integration for AI agents. Optimize tokens with Code Mode and secure connections with OAuth 2.1.

## 🎯 Leverage Core Benefits

| Feature | Description |
| --- | --- |
| **Specialized Tools**                 | Access specialized tools for core CRUD, JSON, spatial data, document stores, and clusters. |
| **Resources**                     | Monitor schema, performance metrics, process lists, replication status, and InnoDB diagnostics in real-time. |
| **AI-Powered Prompts**            | Execute guided workflows for query building, schema design, performance tuning, and infrastructure setup. |
| **Code Mode**                         | Reduce LLM token consumption by consolidating operations inside a secure, sandboxed V8 isolate. |
| **Token-Optimized Payloads**          | Maximize token efficiency. Use optional flags to reduce response size for large payloads. |
| **OAuth 2.1 Security**                | Enforce granular access control with RFC compliance, strict scopes, and Keycloak integration. |
| **Smart Tool Filtering**              | Use tool groups and shortcuts to stay within IDE tool limits. |
| **Dual HTTP Transport**               | Support modern streamable HTTP and legacy SSE clients simultaneously with full session management. |
| **Connection Pooling**                | Leverage built-in connection pooling for efficient, highly concurrent database access. |
| **Ecosystem Integrations**            | Manage MySQL Router, ProxySQL, and MySQL Shell utilities directly from your agent. |
| **Advanced Encryption**               | Enforce TLS/SSL connections. Manage data masking, encryption monitoring, and compliance effortlessly. |
| **Production-Ready Security**         | Prevent SQL injection with parameterized queries. Rely on strict input validation and audit logging. |
| **Deterministic Errors**              | Receive structured responses with actionable suggestions. Eliminate silent failures and raw exceptions. |
| **Observability**                     | Export Prometheus metrics. |
| **Strict TypeScript**                 | Rely on strict TypeScript backed by robust test suites. |
| **Protocol Compliant**                | Support the MCP protocol with tool safety hints, resource priorities, and progress notifications. |

## 🤖 Automate Tasks with Guided Workflows

| Prompt | Description |
| --- | --- |
| `mysql_tool_index` | Complete tool index with categories |
| `mysql_quick_query` | Quick query execution shortcut |
| `mysql_quick_schema` | Quick schema exploration |

> **Note**: This is a subset of available prompts. Use `mysql_tool_index` to discover the full list of guided workflows.

## 📊 Improve Observability with Resources

| Resource | Description |
| --- | --- |
| `mysql://schema` | Full database schema |
| `mysql://tables` | Table listing with metadata |
| `mysql://table/{name}` | Specific Table Schema |
| `mysql://sysschema` | Sys Schema Diagnostics |
| `mysql://help` | Critical gotchas, parameter aliases, and API reference |

> **Note**: This is a subset of available resources. The server exposes many more endpoints for performance, observability, clustering, and health monitoring.

---

## 🚀 Deploy Your AI Database

### Meet Prerequisites

- Docker or Docker Desktop
- MySQL server

### Install the Server

#### Run with Docker (Recommended)

> **Note on Namespaces:** The Docker image uses the `writenotenow` namespace. The repository and package use `neverinfamous`.

> **Linux Users:** Add `--add-host host.docker.internal:host-gateway`. This enables `host.docker.internal` resolution.

```bash
docker run -i --rm -v ./data:/app/data writenotenow/mysql-mcp:latest \
  --transport stdio \
  --allowed-io-roots /app/data \
  --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

#### Observability via Docker Compose

Launch the minimal root-level observability stack using the included `docker-compose.yml` file. This spins up the MCP server, a local MySQL test database, and a Redis container. It includes a pre-configured Prometheus and Grafana observability stack. Note that this configuration overrides `MCP_RATE_LIMIT_MAX` to `10000`.

> **Linux Users:** For `host.docker.internal` on Linux, add `extra_hosts: - "host.docker.internal:host-gateway"` to your `docker-compose.yml` services.

```bash
cp .env.example .env
docker compose up -d
```

- **Grafana:** Available at `http://localhost:3001` (Dashboard pre-loaded).
- **Prometheus:** Available at `http://localhost:9090`.
- **MCP Server:** Available at `http://localhost:3000`.

---

## ⚡ Optimize Token Usage with Code Mode

Code Mode (`mysql_execute_code`) reduces token usage by consolidating operations in a secure sandbox.

Code executes securely in a C++ V8 isolate sandbox. It enforces strict heap limits and synchronous termination. Native wrappers map all API calls across the boundary. This guarantees defense-in-depth and fleet-standard restrictions:

### Enforce Engine-Level Restrictions

- ✅ **Strict V8 Isolate Boundary** — executes within a physically separate V8 isolate. It ensures native objects and prototypes cannot cross the boundary.
- ✅ **Memory & CPU Constraints** — enforced at the C++ level. This includes synchronous timeouts and strict heap limits.
- ✅ **API Bindings via Reference** — Injects MySQL methods securely using `ivm.Reference` wrappers.

### Validate Code Statically

- ✅ **Comprehensive blocked patterns** — regex rules block `require()`, `import()`, `eval()`, `Function`, `process`, and `__proto__`. They also block filesystem/network access and system commands.
- ✅ **Unicode & Comment Sanitization** — Strips comments and performs NFKC normalization to prevent regex evasion.
- ✅ **Configurable code input limit** — prevents payload-based resource exhaustion.

### Protect the Runtime

- ✅ **RPC Quotas** — Caps RPC API calls per execution. This prevents unbounded loops.
- ✅ **Execution timeout** — enforces timeouts to prevent resource exhaustion. Configurable via schema `timeout`.
- ✅ **Egress boundary enforcement** — streaming `JSON.stringify` serialization aborts mid-flight when exceeding size caps.
- ✅ **Rate limiting** — Enforces per-client limits (CODEMODE_RATE_LIMIT_MAX). Uses Redis with in-memory fallbacks.
- ✅ **Readonly enforcement** — Returns structured errors instead of executing write methods when readonly: true.
- ✅ **Audit logging** — Logs every execution with UUID, client ID, metrics, and redacted code preview.
- ✅ **Admin scope** — Code Mode requires `admin` scope when OAuth is enabled.
- ✅ **Full API access** — Exposes all tool groups via the `mysql.*` namespace.

### ⚡ Run Only Code Mode

Run with **only Code Mode enabled**. A single tool provides full capability access. See **[Option 1: Code Mode](#option-1-code-mode-maximum-token-savings--recommended)** below for the recommended IDE configuration.

This exposes just `mysql_execute_code`. Agents write JavaScript against the typed SDK. They compose queries and chain operations across tool groups. They return exactly the needed data in one execution. This mirrors standard serverless edge execution patterns. It ensures fixed token costs.

> **Tip: Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using mysql-mcp, prefer `mysql_execute_code` (Code Mode) for multi-step operations. This minimizes token usage."_
>
> For maximum savings, use `--tool-filter codemode` to run with Code Mode as your only tool. See the [Code Mode wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Code-Mode) for full API documentation.

---

## 🌐 Enable Remote Access via HTTP & SSE

> **When to use HTTP mode:** Deploy `mysql-mcp` as a standalone server. Multiple clients can connect remotely. Use `stdio` mode for local development.

**Use cases for HTTP mode:**

- Run the server in a network-accessible Docker container
- Deploy to cloud platforms (AWS, GCP, Azure)
- Enable OAuth 2.1 authentication for enterprise security
- Share one database connection across multiple AI clients

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  -e MCP_AUTH_TOKEN=my-secret-token \
  writenotenow/mysql-mcp:latest \
  --transport http --server-host 0.0.0.0 --port 3000 --allowed-io-roots /app/data --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

### HTTP Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST/GET | `/mcp` | JSON-RPC requests / SSE stream |
| DELETE | `/mcp` | Session termination |
| GET | `/health` | Health check |
| GET | `/metrics` | Prometheus metrics |

## 🔐 Protect Your Data with Authentication

> **Warning:**
> **HTTP without authentication:** Exposing `--transport http` without authentication grants unrestricted access. Always enable authentication for production HTTP deployments. See [SECURITY.md](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md) for details.

See the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth) for detailed configuration on HTTP mode, CORS, and Rate Limiting. This also covers OAuth setup (with Keycloak).

### Enforce Scopes

| Scope | Access Level |
| --- | --- |
| `read` | Read-only queries (SELECT, EXPLAIN) |
| `write` | Read + write operations |
| `admin` | Full administrative access |
| `full` | Grants all access |
| `db:{name}` | Access to specific database |
| `schema:{name}` | Access to specific schema |
| `table:{schema}:{table}` | Access to specific table |

> **Note:**
> **Per-tool scope enforcement:** The server enforces scopes at the tool level. Each tool group requires a specific scope. When OAuth is enabled, every tool invocation checks the calling token's scopes before execution. The server skips scope checks entirely when OAuth is not configured.

---

## ⚡ Simplify AI Integration with Client Configs

### Configure IDE Settings

Add one of these configurations to your IDE's MCP settings file (e.g., `cline_mcp_settings.json`, `.cursor/mcp.json`, or equivalent):

#### Option 1: Code Mode (Maximum Token Savings, 🌟 Recommended)

**Best for:** General MySQL AI agent tasks. Exposes `mysql_execute_code` for full sandboxed toolset access.

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "TOOL_FILTER",
        "-e", "MYSQL_HOST",
        "-e", "MYSQL_PORT",
        "-e", "MYSQL_USER",
        "-e", "MYSQL_PASSWORD",
        "-e", "MYSQL_DATABASE",
        "-e", "MCP_REQUEST_TIMEOUT",
        "writenotenow/mysql-mcp:latest",
        "--transport",
        "stdio"
      ],
      "env": {
        "TOOL_FILTER": "codemode",
        "MYSQL_HOST": "host.docker.internal",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "secure_password",
        "MYSQL_DATABASE": "testdb",
        "MCP_REQUEST_TIMEOUT": "600000"
      },
      "timeout": 600
    }
  }
}
```

#### Option 2: Cluster (Tools for InnoDB Cluster Monitoring)

**Best for:** Monitoring InnoDB Cluster, Group Replication status, and cluster topology.

> **📖 See the [MySQL Ecosystem Setup Guide](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Ecosystem-Setup)** for detailed prerequisites.

```json
{
  "mcpServers": {
    "mysql-mcp-cluster": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e", "TOOL_FILTER",
        "-e", "MYSQL_HOST",
        "-e", "MYSQL_PORT",
        "-e", "MYSQL_USER",
        "-e", "MYSQL_PASSWORD",
        "-e", "MYSQL_DATABASE",
        "-e", "MCP_REQUEST_TIMEOUT",
        "writenotenow/mysql-mcp:latest",
        "--transport",
        "stdio"
      ],
      "env": {
        "TOOL_FILTER": "cluster",
        "MYSQL_HOST": "host.docker.internal",
        "MYSQL_PORT": "3307",
        "MYSQL_USER": "cluster_admin",
        "MYSQL_PASSWORD": "cluster_password",
        "MYSQL_DATABASE": "mysql",
        "MCP_REQUEST_TIMEOUT": "600000"
      },
      "timeout": 600
    }
  }
}
```

#### Option 3: Ecosystem (Tools for InnoDB Cluster Deployments)

**Best for:** MySQL Router, ProxySQL, MySQL Shell, and InnoDB Cluster deployments.

> **📖 See the [MySQL Ecosystem Setup Guide](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Ecosystem-Setup)** for detailed prerequisites.

```json
{
  "mcpServers": {
    "mysql-mcp-ecosystem": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v", "./data:/app/data",
        "-e", "ALLOWED_IO_ROOTS=/app/data",
        "-e", "TOOL_FILTER",
        "-e", "MYSQL_HOST",
        "-e", "MYSQL_PORT",
        "-e", "MYSQL_USER",
        "-e", "MYSQL_PASSWORD",
        "-e", "MYSQL_DATABASE",
        "-e", "MYSQL_XPORT",
        "-e", "MYSQL_ROUTER_URL",
        "-e", "MYSQL_ROUTER_USER",
        "-e", "MYSQL_ROUTER_PASSWORD",
        "-e", "MYSQL_ROUTER_INSECURE",
        "-e", "PROXYSQL_HOST",
        "-e", "PROXYSQL_PORT",
        "-e", "PROXYSQL_USER",
        "-e", "PROXYSQL_PASSWORD",
        "-e", "MYSQLSH_PATH",
        "-e", "MCP_REQUEST_TIMEOUT",
        "writenotenow/mysql-mcp:latest",
        "--transport",
        "stdio"
      ],
      "env": {
        "TOOL_FILTER": "ecosystem",
        "MYSQL_HOST": "host.docker.internal",
        "MYSQL_PORT": "3307",
        "MYSQL_USER": "cluster_admin",
        "MYSQL_PASSWORD": "cluster_password",
        "MYSQL_DATABASE": "testdb",
        "MYSQL_XPORT": "6448",
        "MYSQL_ROUTER_URL": "https://host.docker.internal:8443",
        "MYSQL_ROUTER_USER": "rest_api",
        "MYSQL_ROUTER_PASSWORD": "router_password",
        "MYSQL_ROUTER_INSECURE": "true",
        "PROXYSQL_HOST": "host.docker.internal",
        "PROXYSQL_PORT": "6032",
        "PROXYSQL_USER": "radmin",
        "PROXYSQL_PASSWORD": "radmin",
        "MYSQLSH_PATH": "mysqlsh",
        "MCP_REQUEST_TIMEOUT": "600000"
      },
      "timeout": 600
    }
  }
}
```

## 🔗 Integrate Any MySQL Environment

| Scenario | Host to Use | Example Connection String |
| --- | --- | --- |
| **MySQL on host machine** | `host.docker.internal`    | `mysql://mcp_user:secure_password@host.docker.internal:3306/testdb` |
| **MySQL in Docker**       | Container name or network | `mysql://mcp_user:secure_password@mysql-container:3306/testdb`      |
| **Remote/Cloud MySQL**    | Hostname or IP            | `mysql://mcp_user:secure_password@db.example.com:3306/testdb`       |

> **Tip:** For remote connections, ensure your MySQL server allows connections from Docker's IP range. Also, verify firewalls/security groups permit port 3306.

---

## 🛠️ Prevent Token Limits with Tool Filtering

Use predefined tool bundles to stay within IDE tool limits (e.g., `--tool-filter starter` or `--tool-filter core,json,-codemode`).

### Review Syntax Reference

| Prefix | Target | Example | Effect |
| --- | --- | --- | --- |
| _(none)_ | Shortcut | `starter` | **Whitelist Mode:** Enable ONLY this shortcut |
| _(none)_ | Group | `core` | **Whitelist Mode:** Enable ONLY this group |
| _(none)_ | Tool | `mysql_read_query` | **Whitelist Mode:** Enable ONLY this tool |
| `+` | Group | `+spatial` | Add tools from this group to current set |
| `-` | Group | `-admin` | Remove tools in this group from current set |
| `+` | Tool | `+mysql_explain` | Add one specific tool |
| `-` | Tool | `-mysql_drop_table` | Remove one specific tool |

> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for the complete list of available groups and predefined bundles.

---

## 🎛️ Master Server Configuration

### Configure CLI Options

> **Note:** Items marked with `—` in the CLI flag column are configured exclusively via environment variables.

| Option | Environment Variable | Description |
| --- | --- | --- |
| `--config`, `-c`          | —                       | Configuration file path (.yaml or .json)            |
| `--dump-config`           | —                       | Dump current configuration to stdout and exit       |
| `--version`, `-v`         | —                       | Show version number                                 |
| `--help`, `-h`            | —                       | Show help                                           |
| `--json`                  | —                       | Output in JSON format                               |
| `--transport`, `-t`       | —                       | Transport type: stdio, http, sse (backward-compatibility alias for http) (default: stdio) |
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
| `--metrics-export`        | `MCP_METRICS_EXPORT`    | Metrics export format (e.g., prometheus)            |
| `--log-level`             | `LOG_LEVEL`             | Log level: debug, info, warn, error                 |
| `--allowed-io-roots`      | `ALLOWED_IO_ROOTS`      | JSON array or comma list of allowed paths for all file I/O operations |
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
| —                         | `CODEMODE_ISOLATION`    | Code Mode isolation level                           |
| —                         | `CODEMODE_MAX_RESULT_SIZE` | Max Code Mode result payload in bytes               |
| —                         | `METADATA_CACHE_TTL_MS` | Cache TTL for schema metadata                       |
| —                         | `REDIS_URL`             | Redis connection URL (used for rate limiting)       |
| —                         | `MCP_RATE_LIMIT_MAX`    | Max HTTP requests per minute per IP (default 100) |
| —                         | `CODEMODE_RATE_LIMIT_MAX`| Max Code Mode executions per minute (default 60)    |
| —                         | `MCP_REQUEST_TIMEOUT`   | Global request timeout in ms (default 300000, 600000 recommended for AI clients)       |
| —                         | `MCP_HEADERS_TIMEOUT`   | Global headers timeout in ms (default 5000)         |

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

> **📖 See the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth)** for Keycloak setup and detailed configuration.

---

## 💻 Accelerate Development by Contributing

[Contributing Guidelines](https://github.com/neverinfamous/mysql-mcp/blob/main/CONTRIBUTING.md) • [Security Policy](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md) • [MIT License](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) • [Code of Conduct](https://github.com/neverinfamous/mysql-mcp/blob/main/CODE_OF_CONDUCT.md)


# MySQL MCP Server (mysql-mcp)

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) ![Coverage](https://img.shields.io/badge/Coverage-84.39%25-yellowgreen.svg) ![E2E](https://img.shields.io/badge/E2E-312%20passing%20%C2%B7%200%20skipped-blue.svg)

> **Note:** Docker Hub limits descriptions to 25k characters. Some documentation may be truncated. View the **[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** or the [GitHub README](https://github.com/neverinfamous/mysql-mcp) for complete details.

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/mysql-mcp/blob/main/CHANGELOG.md)** • **[Security](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## 💎 Value Proposition

Accelerate your AI agents with production-ready MySQL integration. Deploy MCP v2 stateless architecture via HTTP transport. Maximize token efficiency via Code Mode. Secure your database with OAuth 2.1.

## 🎯 Leverage Core Benefits

mysql-mcp provides specialized tools for CRUD, JSON, spatial data, and clusters. It features AI-powered prompts and Code Mode for token optimization. Enjoy OAuth 2.1 security, strict tool filtering, built-in connection pooling, and advanced observability. 

> **📖 View the complete feature list and architecture details in the [Wiki](https://github.com/neverinfamous/mysql-mcp/wiki).**

## 🤖 Automate Tasks with Guided Workflows

| Prompt | Description |
| --- | --- |
| `mysql_tool_index` | Complete tool index with categories |
| `mysql_quick_query` | Quick query execution shortcut |
| `mysql_quick_schema` | Quick schema exploration |

> **Note**: This is a subset of available prompts. Use `mysql_tool_index` to discover the full list of guided workflows.

## 📊 Improve Observability with Resources

Monitor schema, performance metrics, process lists, replication status, and InnoDB diagnostics in real-time. Available resources include `mysql://schema`, `mysql://performance`, `mysql://health`, `mysql://metrics`, `mysql://audit`, and more.

> **📖 Discover all available resources in the [Resources Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Resources).**

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
docker run -i --rm -v ./data:/app/data -v ./logs:/var/log/mysql-mcp writenotenow/mysql-mcp:latest \
  --transport stdio \
  --allowed-io-roots /app/data \
  --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

#### Enable Observability via Docker Compose

Launch the full observability stack (Datadog + OpenTelemetry + Prometheus + Grafana) using the included template. This spins up the MCP server, MySQL database, Redis, and observability sidecars. See the **[Observability Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Observability)** for deep-dive metrics configuration:

```bash
cd examples/full-observability-ecosystem
cp .env.example .env
docker compose up -d
```

- **Grafana:** Available at `http://localhost:3001` (Dashboard pre-loaded).
- **Prometheus:** Available at `http://localhost:9090`.
- **MCP Server:** Available at `http://localhost:3000`.

**Observability Constraints**:
- **Datadog**: Use `pup` CLI for authentication. Avoid duplicate autodiscovery configurations. Add standard tracking labels (`tags.datadoghq.com/env`, `tags.datadoghq.com/service`, `tags.datadoghq.com/version`) to your containers. Enforce `stop_grace_period: 30s`, `mem_limit: 1536m`, and OpenMetrics timeouts of `10s`. Use `DD_HOSTNAME` and native `/etc/docker/daemon.json` cgroup configurations (`"default-cgroupns-mode": "host"`). Disable `DD_EXTRA_PERFORMANCE_METRICS`.
- **OpenTelemetry**: Telemetry implementations must adhere to the official OTel `gen_ai.*` semantic conventions. Use auto-instrumentation when possible. Ensure `traceparent` and `tracestate` propagation. Utilize batch processors and ensure logs are formatted as JSON logs.
- **Audit Architecture**: The primary MCP server writes execution traces to `mcp-audit.jsonl` via the `--audit-log` flag. The metrics server and exporter share a single process. Both operate on port `3000`. This prevents port contention. It reads from `mcp-audit.jsonl` using the `AUDIT_LOG_PATH` environment variable to compute metrics. The exporter isolates its own internal logs by setting its `--audit-log` flag to `exporter-audit.jsonl`.
- **Exporter Healthcheck**: `wget --spider -q http://127.0.0.1:3000/metrics`

---

## ⚡ Optimize Token Usage with Code Mode

Code Mode (`mysql_execute_code`) reduces token usage by consolidating operations in a secure sandbox.

Code executes securely in a C++ V8 isolate sandbox. It enforces strict heap limits and synchronous termination. Native wrappers map all API calls across the boundary. This guarantees defense-in-depth and fleet-standard restrictions:

### Enforce Engine-Level Restrictions

- ✅ **Strict V8 Isolate Boundary** — Code executes within a physically separate V8 isolate. It ensures native objects and prototypes cannot cross the boundary.
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

### Review Performance Benchmarks

The server handles millions of ops/sec across core execution paths. This ensures minimal latency and maximum throughput. Every component is tuned for enterprise-scale workloads. Enjoy sub-millisecond sandbox cold starts and optimized reverse lookups.

**Benchmark Baselines:**
- parseToolFilter: ~32,000-62,000 ops/sec
- CodeModeSandbox.create cold start: ~2.78M ops/sec
- Sandbox dispose: ~2.37M ops/sec
- SandboxPool init: ~109k ops/sec
- Set.has tool check: ~4.4M ops/sec
- Map.get reverse lookup: ~4.5M ops/sec
- Map.get URI match: ~5.1M ops/sec
- validateCode safe short: ~173k ops/sec
- validateCode blocked: ~298k ops/sec
- checkRateLimit: ~205k ops/sec
- sanitizeResult small payload: ~1.49M ops/sec
- prompt schema parse: ~1.3M ops/sec

### ⚡ Run Only Code Mode

Run with **only Code Mode enabled**. A single tool provides full capability access. See **[Option 1: Code Mode](#option-1-code-mode-maximum-token-savings--recommended)** below for the recommended IDE configuration.

This exposes just `mysql_execute_code`. Agents write JavaScript against the typed SDK. They compose queries and chain operations across tool groups. They return exactly the needed data in one execution. This mirrors standard serverless edge execution patterns. It ensures fixed token costs.

> **Tip: Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using mysql-mcp, prefer `mysql_execute_code` (Code Mode) for multi-step operations. This minimizes token usage."_
>
> For maximum savings, use `--tool-filter codemode` to run with Code Mode as your only tool. See the [Code Mode wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Code-Mode) for full API documentation.

---

## 🌐 Enable Remote Access via Streamable & Stateless HTTP

> **When to use HTTP mode:** Deploy `mysql-mcp` as a standalone server. Multiple clients can connect remotely. Use `stdio` mode for local development.

**Use cases for HTTP mode:**

- Run the server in a network-accessible Docker container
- Deploy to cloud platforms (AWS, GCP, Azure)
- Enable OAuth 2.1 authentication for enterprise security
- Share one database connection across multiple AI clients

```bash
docker run --rm -p 3000:3000 \
  -v ./data:/app/data \
  -v ./logs:/var/log/mysql-mcp \
  -e MCP_AUTH_TOKEN=my-secret-token \
  writenotenow/mysql-mcp:latest \
  --transport http --server-host 0.0.0.0 --port 3000 --allowed-io-roots /app/data --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

### Access HTTP Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/mcp` | JSON-RPC requests (initialize, tools/list, etc.) |
| `GET` | `/mcp` | SSE stream for server notifications |
| `DELETE` | `/mcp` | Session termination |
| `GET` | `/health` | Health check |
| `GET` | `/metrics` | Prometheus metrics |

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
| `table:{db}:{table}` | Access to specific table |

> **Note:**
> **Per-tool scope enforcement:** The server enforces scopes at the tool level. Each tool group requires a specific scope. When OAuth is enabled, every tool invocation checks the calling token's scopes before execution. The server skips scope checks entirely when OAuth is not configured.

---

## ⚡ Simplify AI Integration with Client Configs

### Install Agent Skills

For optimal AI performance, `mysql-mcp` includes specialized agent instructions in the [`skills/`](https://github.com/neverinfamous/mysql-mcp/tree/main/skills) directory. These skills teach AI coding assistants (like Cline, Antigravity, or Copilot) how to effectively use the server's capabilities, tool filters, and Code Mode.

To install: Copy the `.md` files from the `skills/` directory into your AI assistant's designated skills or custom instructions folder (e.g., `.cursor/rules/`, `.agents/skills/`, etc.). This enables your agent to autonomously navigate the `mysql-mcp` ecosystem without hallucinating usage patterns.

### Configure IDE Settings

Add a configuration to your IDE's MCP settings file.

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
        "MYSQL_DATABASE": "testdb"
      },
      "timeout": 600
    }
  }
}
```

#### Option 2: Cluster (Tools for InnoDB Cluster Monitoring)

**Best for:** Monitoring InnoDB Cluster, Group Replication status, and cluster topology.

> **⚠️ Prerequisites:**
>
> - **InnoDB Cluster** must be configured and running with Group Replication enabled
> - Connect to a cluster node directly (e.g., `localhost:3307`) — NOT a standalone MySQL instance
> - Use `cluster_admin` or `root` user with appropriate privileges
> - See [MySQL Ecosystem Setup Guide](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Ecosystem-Setup) for cluster setup instructions

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
        "MYSQL_DATABASE": "mysql"
      },
      "timeout": 600
    }
  }
}
```

#### Option 3: Ecosystem (Tools for InnoDB Cluster Deployments)

**Best for:** MySQL Router, ProxySQL, MySQL Shell, and InnoDB Cluster deployments.

> **⚠️ Prerequisites:**
>
> - **InnoDB Cluster** requires a running cluster. This enables Router REST API authentication.
> - Router REST API uses self-signed HTTPS certificates. Set `MYSQL_ROUTER_INSECURE=true` to bypass verification.
> - **X Protocol:** InnoDB Cluster includes the MySQL X Plugin by default. Set `MYSQL_XPORT` to the Router's X Protocol port (e.g., `6448`). This enables `mysqlsh_import_json` and `docstore` tools
> - See [MySQL Ecosystem Setup Guide](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Ecosystem-Setup) for detailed instructions

```json
{
  "mcpServers": {
    "mysql-mcp-ecosystem": {
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
        "-e", "MYSQL_ROUTER_URL",
        "-e", "MYSQL_ROUTER_USER",
        "-e", "MYSQL_ROUTER_PASSWORD",
        "-e", "MYSQL_ROUTER_INSECURE",
        "-e", "MYSQL_XPORT",
        "-e", "PROXYSQL_HOST",
        "-e", "PROXYSQL_PORT",
        "-e", "PROXYSQL_USER",
        "-e", "PROXYSQL_PASSWORD",
        "-e", "MYSQLSH_PATH",
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
        "MYSQL_ROUTER_URL": "https://host.docker.internal:8443",
        "MYSQL_ROUTER_USER": "rest_api",
        "MYSQL_ROUTER_PASSWORD": "router_password",
        "MYSQL_ROUTER_INSECURE": "true",
        "MYSQL_XPORT": "6448",
        "PROXYSQL_HOST": "host.docker.internal",
        "PROXYSQL_PORT": "6032",
        "PROXYSQL_USER": "radmin",
        "PROXYSQL_PASSWORD": "radmin",
        "MYSQLSH_PATH": "mysqlsh"
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

## 🛠️ Optimize Limits with Tool Filtering

Use predefined tool bundles to stay within IDE tool limits. Example: `--tool-filter starter`.

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

mysql-mcp supports extensive configuration via CLI flags and environment variables, including transport settings, database credentials, connection pool sizing, OAuth integration, Code Mode sandboxing limits, and observability configurations.

> **📖 View the complete list of CLI options and environment variables in the [Configuration Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Configuration).**

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

> **📖 See the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth)** for Keycloak setup and detailed configuration.

---

## 💻 Accelerate Development by Contributing

[Contributing Guidelines](https://github.com/neverinfamous/mysql-mcp/blob/main/CONTRIBUTING.md) • [Security Policy](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md) • [MIT License](https://github.com/neverinfamous/mysql-mcp/blob/main/LICENSE) • [Code of Conduct](https://github.com/neverinfamous/mysql-mcp/blob/main/CODE_OF_CONDUCT.md)


# mysql-mcp

<!-- mcp-name: io.github.neverinfamous/mysql-mcp -->

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg) ![Coverage](https://img.shields.io/badge/Coverage-89.22%25-green.svg) ![E2E](https://img.shields.io/badge/E2E-393%20passing%20%C2%B7%200%20skipped-blue.svg) ![Coverage](https://img.shields.io/badge/Coverage-Passing-green.svg) ![E2E Tests](https://img.shields.io/badge/E2E-Passing-brightgreen.svg)](https://opensource.org/licenses/MIT)

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## 💎 Value Proposition

MySQL MCP delivers production-ready integration for AI agents. Slash token consumption and consolidate complex operations using Code Mode's isolated sandbox. Scale reliably with built-in connection pooling. Secure database access using strict OAuth 2.1 validation.

## 🎯 Leverage Core Benefits

| Feature                               | Description                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specialized Tools**                 | Access an extensive suite of specialized tools. Manage core CRUD, JSON, spatial data, document stores, and clusters. |
| **Resources**                     | Monitor schema, performance metrics, process lists, replication status, and InnoDB diagnostics in real-time. |
| **AI-Powered Prompts**            | Execute guided workflows for query building, schema design, performance tuning, and infrastructure setup. |
| **Code Mode**                         | Execute operations locally inside a V8 isolate. Reduces LLM token consumption by consolidating operations via sandboxed Code Mode. |
| **Token-Optimized Payloads**          | Maximize token efficiency. Use optional flags to reduce response size for large payloads. |
| **OAuth 2.1 Security**                | Enforce granular access control with RFC compliance, strict scopes, and Keycloak integration. |
| **Smart Tool Filtering**              | Use tool groups and shortcuts to stay within IDE tool limits. |
| **Dual HTTP Transport**               | Support modern streamable HTTP and legacy SSE clients simultaneously with full session management. |
| **Connection Pooling**                | Leverage built-in connection pooling for efficient, highly concurrent database access. |
| **Ecosystem Integrations**            | Manage MySQL Router, ProxySQL, and MySQL Shell utilities directly from your agent. |
| **Advanced Encryption**               | Enforce TLS/SSL connections. Manage data masking, encryption monitoring, and compliance effortlessly. |
| **Production-Ready Security**         | Prevent SQL injection with parameterized queries. Rely on strict input validation and audit logging. |
| **Deterministic Errors**              | Receive structured responses with actionable suggestions. Eliminate silent failures and raw exceptions. |
| **Observability**                     | Persist local metrics via SystemDb. Export Prometheus metrics to Grafana. Monitor Token & AI Efficiency with Datadog eBPF / APM. Monitor logs with Dozzle. |
| **Strict TypeScript**                 | Rely on strict TypeScript backed by robust test suites. Execute pipelines with zero skipped tests. |
| **Protocol Compliant**                | Support the MCP protocol with tool safety hints, resource priorities, and progress notifications. |

---

## 🚀 Deploy Your AI Database in Minutes

### Meet Prerequisites

- Recent Node.js (LTS recommended)
- Bun
- MySQL 5.7+ server
- pnpm

### Install the Server

#### NPM / PNPM (Recommended)

```bash
pnpm add -g @neverinfamous/mysql-mcp
```

Run the server:

```bash
mysql-mcp --transport stdio --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb"
```

Or use npx without installing:

```bash
npx @neverinfamous/mysql-mcp --transport stdio --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb"
```

#### Run with Docker

> **Note on Namespaces:** The Docker image uses the `writenotenow` namespace. The GitHub repo uses `neverinfamous`.

```bash
docker run -i --rm writenotenow/mysql-mcp:latest \
  --transport stdio \
  --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

#### Observability via Docker Compose

Launch the observability stack with MCP, Prometheus, and a pre-configured Grafana dashboard:

```bash
cp .env.example .env
docker compose up -d
```

- **Grafana:** Available at `http://localhost:3001` (Dashboard pre-loaded).
- **Datadog:** Pre-configured with custom AI Efficiency, Token, and Database dashboards (requires API key).
- **Prometheus:** Available at `http://localhost:9090`.
- **MCP Server:** Available at `http://localhost:3000`.

#### From Source

```bash
git clone https://github.com/neverinfamous/mysql-mcp.git
cd mysql-mcp
pnpm install
pnpm run build
node dist/cli.js --transport stdio --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb"
```

---

## ⚡ Reduce Token Usage with Code Mode

Code Mode (`mysql_execute_code`) reduces LLM token consumption by consolidating operations in a secure JavaScript sandbox. It is included by default.

Code executes securely in a C++ V8 isolate sandbox. It enforces strict heap limits and synchronous termination. Native wrappers map all API calls across the boundary. This guarantees defense-in-depth and fleet-standard restrictions:

### Enforce Engine-Level Restrictions

- ✅ **Strict V8 Isolate Boundary** — executes within a physically separate V8 isolate. It ensures native objects and prototypes cannot cross the boundary.
- ✅ **Memory & CPU Constraints** — enforced at the C++ level. This includes synchronous timeouts and strict heap limits.
- ✅ **API Bindings via Reference** — all MySQL API methods are securely injected into the isolate using `ivm.Reference` wrappers.

### Validate Code Statically

- ✅ **Comprehensive blocked patterns** — regex rules block `require()`, `import()`, `eval()`, `process`, and `__proto__`. They also block filesystem/network access and system commands.
- ✅ **Unicode & Comment Sanitization** — performs NFKC normalization and strips all comments before pattern validation to prevent regex evasion.
- ✅ **Configurable code input limit** — prevents payload-based resource exhaustion.

### Protect the Runtime

- ✅ **RPC Quotas** — Configurable RPC API call cap per execution to prevent unbounded loops.
- ✅ **Execution timeout** — Enforces an execution timeout to prevent resource exhaustion. Execution timeouts are dynamically configurable via the `timeout` parameter in the `callTool` JSON schema.
- ✅ **Egress boundary enforcement** — streaming `JSON.stringify` serialization aborts mid-flight when exceeding size caps (default 100KB).
- ✅ **Rate limiting** — Rate limited per client (configurable via `CODEMODE_RATE_LIMIT_MAX`). Distribute limits across deployments via Redis using graceful in-memory fallbacks.
- ✅ **Readonly enforcement** — when `readonly: true`, write methods return structured errors instead of executing.
- ✅ **Audit logging** — Logs every execution with UUID, metrics, and redacted code preview.
- ✅ **Admin scope** — Code Mode requires `admin` scope when OAuth is enabled.
- ✅ **Full API access** — Exposes all tool groups via the mysql.* namespace.

### ⚡ Run Only Code Mode

Run with **only Code Mode enabled**. A single tool provides full capability access. See **[Option 1: Code Mode](#option-1-code-mode-maximum-token-savings--recommended)** below for the recommended IDE configuration.

This exposes just `mysql_execute_code`. Agents write JavaScript against the typed SDK. They compose queries and chain operations across tool groups. They return exactly the needed data in one execution. This mirrors standard serverless edge execution patterns. It ensures fixed token costs.

> [!TIP]
> **Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using mysql-mcp, prefer `mysql_execute_code` (Code Mode) for multi-step database operations to minimize token usage."_
>
> For maximum savings, use `--tool-filter codemode` to run with Code Mode as your only tool. See the [Code Mode wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Code-Mode) for full API documentation.

---

## 🌐 Enable Remote Access via HTTP & SSE

Use the HTTP transport for remote access:

```bash
npx -y @neverinfamous/mysql-mcp \
  --transport http \
  --server-host 0.0.0.0 \
  --port 3000 \
  --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb"
```

**Docker:**

```bash
docker run --rm -p 3000:3000 \
  writenotenow/mysql-mcp:latest \
  --transport http --server-host 0.0.0.0 --port 3000 --mysql "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
```

The server supports **two MCP transport protocols simultaneously**. Both modern and legacy clients can connect:

### Use Streamable HTTP (Recommended)

Modern protocol (MCP 2024-11-05) — single endpoint, session-based:

| Method   | Endpoint | Purpose                                          |
| -------- | -------- | ------------------------------------------------ |
| `POST`   | `/mcp`   | JSON-RPC requests (initialize, tools/list, etc.) |
| `GET`    | `/mcp`   | SSE stream for server notifications              |
| `DELETE` | `/mcp`   | Session termination                              |

> **Rate Limit:** HTTP transport is rate limited per IP (default 10000/min, configurable via `MCP_RATE_LIMIT_MAX`). Distribute limits across deployments via Redis using graceful in-memory fallbacks.

The server manages sessions via the `Mcp-Session-Id` header.

### Run Statelessly

Use stateless deployments where sessions are not needed:

```bash
node dist/cli.js --transport http --server-host 0.0.0.0 --port 3000 --stateless --mysql "mysql://mcp_user:secure_password@..."
```

In stateless mode: `GET /mcp` returns 405, `DELETE /mcp` returns 204, `/sse` and `/messages` return 404. Each `POST /mcp` creates a fresh transport.

### Connect via Legacy SSE (Backward Compatibility)

Connect via Legacy SSE — for clients like Python `mcp.client.sse`:

| Method | Endpoint                   | Purpose                                                       |
| ------ | -------------------------- | ------------------------------------------------------------- |
| `GET`  | `/sse`                     | Opens SSE stream, returns `/messages?sessionId=<id>` endpoint |
| `POST` | `/messages?sessionId=<id>` | Send JSON-RPC messages to the session                         |

### Access Utility Endpoints

| Method | Endpoint   | Purpose                                                                |
| ------ | ---------- | ---------------------------------------------------------------------- |
| `GET`  | `/health`  | Health check (bypasses rate limiting, always available for monitoring) |
| `GET`  | `/metrics` | Exports Prometheus metrics (available when `--metrics-export` is enabled) |

## 🔐 Protect Your Data with Authentication

mysql-mcp supports two authentication mechanisms for HTTP transport:

### Authenticate with Bearer Token (`--auth-token`)

Use lightweight authentication for development:

```bash
node dist/cli.js --transport http --server-host 0.0.0.0 --port 3000 --auth-token my-secret --mysql "mysql://mcp_user:secure_password@..."

# Or via environment variable
export MCP_AUTH_TOKEN=my-secret
node dist/cli.js --transport http --server-host 0.0.0.0 --port 3000 --mysql "mysql://mcp_user:secure_password@..."
```

Clients must include `Authorization: Bearer my-secret` on all requests. `/health` and `/` are exempt. Unauthenticated requests receive `401` with `WWW-Authenticate: Bearer` headers per RFC 6750.

### Authenticate with OAuth 2.1

Use full OAuth 2.1 for production deployments:

```bash
node dist/cli.js \
  --transport http \
  --server-host 0.0.0.0 \
  --port 3000 \
  --mysql "mysql://mcp_user:secure_password@localhost:3306/testdb" \
  --oauth-enabled \
  --oauth-issuer http://localhost:8080/realms/mysql-mcp \
  --oauth-audience mysql-mcp-client
```

> **Additional flags:** `--oauth-jwks-uri <url>` (auto-discovered if omitted), `--oauth-clock-tolerance <seconds>` (default: 60).

### Enforce OAuth Scopes

Access control is managed through OAuth scopes:

| Scope                    | Access Level                        |
| ------------------------ | ----------------------------------- |
| `read`                   | Read-only queries (SELECT, EXPLAIN) |
| `write`                  | Read + write operations             |
| `admin`                  | Full administrative access          |
| `full`                   | Grants all access                   |
| `db:{name}`              | Access to specific database         |
| `schema:{name}`          | Access to specific schema           |
| `table:{schema}:{table}` | Access to specific table            |

### Ensure RFC Compliance

This implementation follows full OAuth 2.1 for production multi-tenant deployments:

- ✅ **RFC 9728** Protected Resource Metadata (`/.well-known/oauth-protected-resource`)
- ✅ **RFC 8414** Authorization Server Discovery with caching
- ✅ **RFC 7591** OAuth 2.1 Dynamic Client Registration
- ✅ **JWT validation** with JWKS support (TTL: 1 hour, configurable)
- ✅ **MySQL-specific scopes**: `read`, `write`, `admin`, `full`, `db:{name}`, `schema:{name}`, `table:{schema}:{table}`
- ✅ **Per-tool scope enforcement** via `AsyncLocalStorage` context threading

> **Note for Keycloak users:** Add an **Audience mapper** to your client. This includes the correct `aud` claim. (Client → Client scopes → dedicated scope → Add mapper → Audience)

> [!NOTE]
> **Per-tool scope enforcement:** Scopes are enforced at the tool level. Each tool group requires a specific scope. When OAuth is enabled, every tool invocation checks the calling token's scopes before execution. When OAuth is not configured, scope checks are skipped entirely.

> [!WARNING]
> **HTTP without authentication:** Exposing `--transport http` without authentication grants unrestricted access. Always enable authentication for production HTTP deployments. See [SECURITY.md](SECURITY.md) for details.

## ⚡ Simplify AI Integration with Client Configs

### Configure Cursor or Claude Desktop

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@neverinfamous/mysql-mcp",
        "--transport",
        "stdio",
        "--tool-filter",
        "starter",
        "--mysql",
        "mysql://mcp_user:secure_password@localhost:3306/testdb"
      ],
      "timeout": 600
    }
  }
}
```

### Use Environment Variables (Recommended)

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "npx",
      "args": ["-y", "@neverinfamous/mysql-mcp", "--transport", "stdio", "--tool-filter", "starter"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "secure_password",
        "MYSQL_DATABASE": "testdb",
        "MYSQL_XPORT": "33060"
      },
      "timeout": 600
    }
  }
}
```

> **Note:** `MYSQL_XPORT` (X Protocol port) defaults to `33060` if omitted. Set MYSQL_XPORT to the Router port for docstore tools.

> **📖 See the [Configuration Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Configuration)** for more configuration options.

---

## 🔗 Integrate Any MySQL Environment

| Scenario                  | Host to Use               | Example Connection String                        |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **MySQL on host machine** | `localhost` / `host.docker.internal` | `mysql://mcp_user:secure_password@localhost:3306/testdb` |
| **MySQL in Docker**       | Container name or network | `mysql://mcp_user:secure_password@mysql-container:3306/testdb`      |
| **Remote/Cloud MySQL**    | Hostname or IP            | `mysql://mcp_user:secure_password@db.example.com:3306/testdb`       |

### Connect to MySQL on Host Machine

If MySQL is installed directly on your computer (via installer, Homebrew, etc.) and you are running the MCP server natively via Node/`npx`, use `localhost` or `127.0.0.1`. If you are running the MCP server inside a Docker container, use `host.docker.internal`:

```json
[
  "--mysql",
  "mysql://mcp_user:secure_password@host.docker.internal:3306/testdb"
]
```

### Connect to MySQL in Another Docker Container

For Docker setups, use `host.docker.internal`. For Docker Compose, use the `mysql` service name.

Create a network and run MySQL:

```bash
docker network create mynet
docker run -d --name mysql-db --network mynet -e MYSQL_ROOT_PASSWORD=pass mysql:8
```

Run MCP server on the same network:

```bash
docker run -i --rm --network mynet writenotenow/mysql-mcp:latest \
  --transport stdio --mysql "mysql://mcp_user:secure_password@mysql-db:3306/testdb"
```

### Connect to Remote/Cloud MySQL (RDS, Cloud SQL, etc.)

Use the remote hostname directly:

```json
[
  "--mysql",
  "mysql://mcp_user:secure_password@your-instance.region.rds.amazonaws.com:3306/testdb"
]
```

| Provider         | Example Hostname                                 |
| ---------------- | ------------------------------------------------ |
| AWS RDS          | `your-instance.xxxx.us-east-1.rds.amazonaws.com` |
| Google Cloud SQL | `project:region:instance` (via Cloud SQL Proxy)  |
| Azure MySQL      | `your-server.mysql.database.azure.com`           |
| PlanetScale      | `aws.connect.psdb.cloud` (SSL required)          |
| DigitalOcean     | `your-cluster-do-user-xxx.db.ondigitalocean.com` |

> **Tip:** For remote connections, ensure your MySQL server allows connections from Docker's IP range and that firewalls/security groups permit port 3306.

---

## 🛠️ Prevent Token Limits with Tool Filtering

> [!IMPORTANT]
> **AI IDEs like Cursor have strict tool limits. You MUST use tool filtering.** This keeps you within your IDE's limits. All shortcuts and tool groups include **Code Mode** by default. To exclude it, add `-codemode` to your filter: `--tool-filter core,json,-codemode`

### Discover Filtering Options

The `--tool-filter` argument accepts **shortcuts**, **groups**, or **tool names** — mix and match freely:

| Filter Pattern   | Example                     | Description               |
| ---------------- | --------------------------- | ------------------------- |
| Shortcut only    | `starter`                   | Use a predefined bundle   |
| Groups only      | `core,json,transactions`    | Combine individual groups |
| Shortcut + Group | `starter,spatial`           | Extend a shortcut         |
| Shortcut - Tool  | `starter,-mysql_drop_table` | Remove specific tools     |

### Use Predefined Shortcuts

> Note: `codemode` is listed in the shortcuts table for demonstrative completeness, as it is automatically injected.

| Shortcut        | Use Case           | What's Included                                                    |
| --------------- | ------------------ | ------------------------------------------------------------------ |
| `starter`         | Standard Package    | core, json, transactions, text, codemode                         |
| `essential`       | Minimal footprint   | core, transactions, codemode                                     |
| `dev-power`       | Power Developer     | core, schema, performance, fulltext, transactions, codemode      |
| `dev-analytics`   | Developer Analytics | core, stats, performance, codemode                               |
| `ai-data-nosql`   | AI Data NoSQL       | core, json, docstore, codemode                                   |
| `ai-search`       | AI Search           | core, text, fulltext, vector, codemode                           |
| `ai-spatial`      | AI Spatial Analyst  | core, spatial, transactions, codemode                            |
| `ai-vector`       | AI Vector Analyst   | core, vector, fulltext, codemode                                 |
| `dba-monitor`     | DBA Monitoring      | core, monitoring, performance, sysschema, optimization, codemode |
| `dba-manage`      | DBA Management      | core, admin, backup, replication, partitioning, events, codemode |
| `dba-secure`      | DBA Security        | core, security, roles, transactions, codemode                    |
| `dba-schema`      | DBA Schema          | core, schema, introspection, migration, codemode                 |
| `base-relational` | Base Relational     | core, transactions, text, schema, codemode                       |
| `base-analytics`  | Base Analytics      | stats, events, codemode                                          |
| `base-nosql`      | Base NoSQL          | docstore, spatial, vector, codemode                              |
| `ecosystem`       | External Tools      | cluster, proxysql, router, shell, codemode                       |

### Leverage Available Tool Groups

To optimize AI context windows, tool groups are categorized into high-level domains. **[See the Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for the exhaustive list.

| Category | Key Tool Groups | Description |
|---|---|---|
| **Core CRUD** | `core`, `json`, `transactions`, `vector`, `spatial`, `text` | Essential database operations, querying, and specialized data types. |
| **Schema** | `schema`, `introspection`, `migration` | Structure design, dependency analysis, and version management. |
| **Observability** | `performance`, `monitoring`, `sysschema`, `stats` | Real-time diagnostics, EXPLAIN analysis, and anomaly detection. |
| **Ecosystem** | `cluster`, `proxysql`, `router`, `shell` | Integration with MySQL Router, ProxySQL, and InnoDB Cluster. |
| **Administration** | `admin`, `backup`, `security`, `roles` | Server maintenance, snapshots, and OAuth/RBAC security configuration. |

---

### Configure IDE Settings

Add one of these configurations to your IDE's MCP settings file (e.g., `cline_mcp_settings.json`, `.cursor/mcp.json`, or equivalent):

#### Option 1: Code Mode (Maximum Token Savings, 🌟 Recommended)

**Best for:** General MySQL AI agent tasks. Exposes `mysql_execute_code` for full sandboxed toolset access.

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "@neverinfamous/mysql-mcp",
        "--transport",
        "stdio",
        "--tool-filter",
        "codemode"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "mcp_user",
        "MYSQL_PASSWORD": "secure_password",
        "MYSQL_DATABASE": "testdb",
        "REDIS_URL": "redis://localhost:6379"
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
      "command": "npx",
      "args": [
        "-y",
        "@neverinfamous/mysql-mcp",
        "--transport",
        "stdio",
        "--tool-filter",
        "cluster"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
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
> - **X Protocol:** InnoDB Cluster includes the MySQL X Plugin by default. Set `MYSQL_XPORT` to the Router's X Protocol port (e.g., `6448`) for `mysqlsh_import_json` and `docstore` tools
> - See [MySQL Ecosystem Setup Guide](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Ecosystem-Setup) for detailed instructions

```json
{
  "mcpServers": {
    "mysql-mcp-ecosystem": {
      "command": "npx",
      "args": [
        "-y",
        "@neverinfamous/mysql-mcp",
        "--transport",
        "stdio",
        "--tool-filter",
        "ecosystem"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3307",
        "MYSQL_XPORT": "6448",
        "MYSQL_USER": "cluster_admin",
        "MYSQL_PASSWORD": "cluster_password",
        "MYSQL_DATABASE": "testdb",
        "MYSQL_ROUTER_URL": "https://localhost:8443",
        "MYSQL_ROUTER_USER": "rest_api",
        "MYSQL_ROUTER_PASSWORD": "router_password",
        "MYSQL_ROUTER_INSECURE": "true",
        "PROXYSQL_HOST": "localhost",
        "PROXYSQL_PORT": "6032",
        "PROXYSQL_USER": "radmin",
        "PROXYSQL_PASSWORD": "radmin",
        "MYSQLSH_PATH": "/usr/local/bin/mysqlsh"
      },
      "timeout": 600
    }
  }
}
```

**Customization Notes:**

- Replace `/path/to/mysql-mcp/` with your actual installation path
- Update credentials with your actual values
- For Windows: Use forward slashes (e.g., `C:/mysql-mcp/dist/cli.js`) or escape backslashes
- For Windows MySQL Shell: `"MYSQLSH_PATH": "C:\\Program Files\\MySQL\\MySQL Shell 8.4\\bin\\mysqlsh.exe"`
- **Router Authentication:** Router REST API authenticates against the InnoDB Cluster metadata. The cluster must be running for authentication to work.
- **Cluster Resource:** The `mysql://cluster` resource is only available when connected to an InnoDB Cluster node

---

**Legacy Syntax (still supported):**
If you start with a negative filter (e.g., `-ecosystem`), it enables all tools first. It then subtracts the specified tools.

### Review Syntax Reference

| Prefix   | Target   | Example             | Effect                                        |
| -------- | -------- | ------------------- | --------------------------------------------- |
| _(none)_ | Shortcut | `starter`           | **Whitelist Mode:** Enable ONLY this shortcut |
| _(none)_ | Group    | `core`              | **Whitelist Mode:** Enable ONLY this group    |
| _(none)_ | Tool     | `mysql_read_query`  | **Whitelist Mode:** Enable ONLY this tool     |
| `+`      | Group    | `+spatial`          | Add tools from this group to current set      |
| `-`      | Group    | `-admin`            | Remove tools in this group from current set   |
| `+`      | Tool     | `+mysql_explain`    | Add one specific tool                         |
| `-`      | Tool     | `-mysql_drop_table` | Remove one specific tool                      |

### Customize Tool Selection

List tool names without `+` prefix to create a custom whitelist.

The easiest way to filter is using **whitelist mode**. Simply specify the shortcut you want. Everything else is automatically disabled.

```bash
# Enable specific tools (whitelist mode)
--tool-filter "mysql_read_query,mysql_write_query,mysql_list_tables"

# Mix tools from different groups
--tool-filter "mysql_read_query,mysql_explain,mysql_json_extract"

# Combine with a shortcut or group
--tool-filter "starter,+mysql_spatial_distance,+mysql_json_diff"
```

Use this for automated clients requiring a minimal capability set.

> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for advanced examples.

---

## 🤖 Automate Tasks with Guided Workflows

This server includes **intelligent prompts** for guided workflows:

| Prompt                        | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| `mysql_tool_index`            | Complete tool index with categories                    |
| `mysql_quick_query`           | Quick query execution shortcut                         |
| `mysql_quick_schema`          | Quick schema exploration                               |

> **Note**: This is a subset of available prompts. Use `mysql_tool_index` to discover the full list of guided workflows.

---

## 📊 Improve Observability with Resources

This server exposes **a comprehensive set of resources** for database observability and telemetry:

| Resource                | Description                                 |
| ----------------------- | ------------------------------------------- |
| `mysql://schema`        | Full database schema                        |
| `mysql://tables`        | Table listing with metadata                 |
| `mysql://table/{name}`  | Specific Table Schema                       |
| `mysql://sys/*`         | System insights (e.g. `mysql_sys_memory_summary`, `mysql_server_health`) |
| `mysql://help`          | Critical gotchas, parameter aliases, and API reference |

> **Note**: This is a subset of available resources. The server exposes many more endpoints for performance, observability, clustering, and health monitoring.

---

## 🔧 Customize with Advanced Configuration

> **Tip:** Configure the server using native JSON or YAML files via the `--config <path>` flag. Precedence follows: CLI Flags > Environment Variables > Config File > Defaults. See the `mcp-config-example.json` template at the root of the project for setup details.

For specialized setups, see these Wiki pages:

| Topic                                                                        | Description                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| [MySQL Router](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Router) | Configure Router REST API access for InnoDB Cluster |
| [ProxySQL](https://github.com/neverinfamous/mysql-mcp/wiki/ProxySQL)         | Configure ProxySQL admin interface access           |
| [MySQL Shell](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Shell)   | Configure MySQL Shell for dump/load operations      |

---

## ⚡ Maximize Server Performance

The server caches schema metadata to reduce repeated queries during tool/resource invocations.

| Variable                    | Default  | Description                                                         |
| --------------------------- | -------- | ------------------------------------------------------------------- |
| `METADATA_CACHE_TTL_MS`     | `30000`  | Cache TTL for schema metadata (milliseconds)                        |
| `LOG_LEVEL`                 | `info`   | Log verbosity: `debug`, `info`, `warn`, `error`                     |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `5000`), or increase it for production with stable schemas (e.g., `300000` = 5 min).

> **Payload optimization:** Tools support `summary: true` and `limit` parameters. These condense large payloads.

---

### Configure CLI Options

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
| `--metrics-export`        | `MCP_METRICS_EXPORT`    | Metrics export format (e.g., prometheus)            |
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
| —                         | `MCP_RATE_LIMIT_MAX`    | Max HTTP requests per minute per IP (default 10000) |
| —                         | `CODEMODE_RATE_LIMIT_MAX`| Max Code Mode executions per minute (default 60)    |
| —                         | `MCP_REQUEST_TIMEOUT`   | Global request timeout in ms (default 300000, 600000 recommended for AI clients)       |
| —                         | `MCP_HEADERS_TIMEOUT`   | Global headers timeout in ms (default 5000)         |

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

### Enforce Scopes

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

## 💻 Accelerate Development by Contributing

See **[From Source](#from-source)** above for setup. After cloning:

```bash
pnpm run check  # Run lint, typecheck, unit tests, and E2E tests
```

### Debug with MCP Inspector

Use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to visually test and debug mysql-mcp:

Build the server first:

```bash
pnpm run build
```

Launch Inspector with mysql-mcp:

```bash
npx @modelcontextprotocol/inspector node dist/cli.js \
  --transport stdio \
  --mysql mysql://user:password@localhost:3306/database
```

Open **http://localhost:5173** to browse all tools, resources, and prompts interactively.

**CLI mode for scripting:**

List all tools:

```bash
npx @modelcontextprotocol/inspector --cli node dist/cli.js \
  --transport stdio --mysql mysql://... \
  --method tools/list
```

Call a specific tool:

```bash
npx @modelcontextprotocol/inspector --cli node dist/cli.js \
  --transport stdio --mysql mysql://... \
  --method tools/call --tool-name mysql_list_tables
```

> **📖 See the [MCP Inspector Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/MCP-Inspector)** for detailed usage.

### Run Unit Tests

The project maintains high test coverage using Vitest.

```bash
pnpm test
```

Run coverage report:

```bash
pnpm run test:coverage
```

**Test Infrastructure:**

- Centralized mock factories in `src/__tests__/mocks/`
- All test files use shared mocks for consistency
- Tests run without database connection (fully mocked)

### Execute Benchmarks

The project includes a performance benchmarking suite to track the efficiency of critical paths like Code Mode sandbox initialization, tool filtering, and URI routing.

```bash
pnpm run bench
```

---

## Contribute to the Project

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Review Security Policy

For security concerns, please see our [Security Policy](SECURITY.md).

> **⚠️ Never commit credentials** - Store secrets in `.env` (gitignored)

## View License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Follow Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.


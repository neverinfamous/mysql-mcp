# mysql-mcp

<!-- mcp-name: io.github.neverinfamous/mysql-mcp -->

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/mysql--mcp-blue?logo=github)](https://github.com/neverinfamous/mysql-mcp)
![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)
[![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/mysql-mcp)
[![E2E](https://img.shields.io/badge/E2E-454%20passing%20%C2%B7%200%20skipped-blue.svg)](https://github.com/neverinfamous/mysql-mcp/actions/workflows/e2e.yml)
[![Tests](https://img.shields.io/badge/Tests-2185%20passing-brightgreen.svg)](https://github.com/neverinfamous/mysql-mcp)
[![Coverage](https://img.shields.io/badge/Coverage-85.27%25-green.svg)](https://github.com/neverinfamous/mysql-mcp)

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## The Most Comprehensive MySQL MCP Server Available

**mysql-mcp** is the definitive **Model Context Protocol server for MySQL** — empowering AI assistants like AntiGravity, Claude, Cursor, and other MCP clients with **unparalleled database capabilities**. Features **Code Mode** — a revolutionary approach that provides access to all 241 tools through a single JavaScript sandbox, eliminating the massive token overhead of multi-step tool calls. Also includes deterministic error handling, process-isolated code execution, and enterprise-grade features without sacrificing ease of use.

## 🎯 What Sets Us Apart

| Feature                               | Description                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **241 Specialized Tools**             | The largest MySQL tool collection for MCP — from core CRUD and native JSON functions (MySQL 5.7+) to advanced spatial/GIS, document store, and cluster management                                                                                                                      |
| **19 Observability Resources**        | Real-time schema, performance metrics, process lists, status variables, replication status, and InnoDB diagnostics                                                                                                                                                                     |
| **19 AI-Powered Prompts**             | Guided workflows for query building, schema design, performance tuning, and infrastructure setup                                                                                                                                                                                       |
| **Code Mode (Massive Token Savings)** | Execute complex operations locally inside a separate V8 isolate (`worker_threads`). Instead of spending thousands of tokens on back-and-forth tool calls, Code Mode exposes all 241 capabilities locally, reducing token overhead by up to 90% while supercharging AI agent reasoning. |
| **Token-Optimized Payloads**          | Every tool response is audited for token efficiency. Tools with large payloads offer optional flags (`summary`, `limit`, `compact`) to reduce response size — monitoring, sysschema, stats, spatial, and cluster tools all support payload reduction                                   |
| **OAuth 2.1 + Access Control**        | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `full`, `db:*`, `table:*:*`), and Keycloak integration                                                                                                                             |
| **Smart Tool Filtering**              | 25 tool groups + 11 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                                                                                                                      |
| **Dual HTTP Transport**               | Streamable HTTP (`/mcp`) for modern clients + legacy SSE (`/sse`) for backward compatibility — both protocols supported simultaneously with session management, security headers, CORS, rate limiting, and body size enforcement                                                       |
| **High-Performance Pooling**          | Built-in connection pooling for efficient, concurrent database access                                                                                                                                                                                                                  |
| **Ecosystem Integrations**            | First-class support for **MySQL Router**, **ProxySQL**, and **MySQL Shell** utilities                                                                                                                                                                                                  |
| **Advanced Encryption**               | Full TLS/SSL support for secure connections, plus tools for managing data masking, encryption monitoring, and compliance                                                                                                                                                               |
| **Production-Ready Security**         | SQL injection protection, parameterized queries, input validation, and audit capabilities                                                                                                                                                                                              |
| **Deterministic Error Handling**      | Every tool returns structured `{success, error, code, category, suggestion, recoverable}` responses — no raw exceptions, no silent failures, no misleading messages. Agents get actionable context instead of cryptic MySQL error codes                                                |
| **Strict TypeScript**                 | 100% type-safe codebase with 2185 tests and 90% coverage                                                                                                                                                                                                                               |
| **MCP 2025-11-25 Compliant**          | Full protocol support with tool safety hints, resource priorities, and progress notifications                                                                                                                                                                                          |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 24+
- MySQL 5.7+ or 8.0+ server
- npm or yarn

### Installation

#### NPM (Recommended)

```bash
pnpm add -g @neverinfamous/mysql-mcp
```

Run the server:

```bash
mysql-mcp --transport stdio --mysql mysql://user:password@localhost:3306/database
```

Or use npx without installing:

```bash
npx @neverinfamous/mysql-mcp --transport stdio --mysql mysql://user:password@localhost:3306/database
```

#### Docker

```bash
docker run -i --rm writenotenow/mysql-mcp:latest \
  --transport stdio \
  --mysql mysql://user:password@host.docker.internal:3306/database
```

#### From Source

```bash
git clone https://github.com/neverinfamous/mysql-mcp.git
cd mysql-mcp
pnpm install
pnpm run build
node dist/cli.js --transport stdio --mysql mysql://user:password@localhost:3306/database
```

---

## Code Mode: Maximum Efficiency

Code Mode (`mysql_execute_code`) dramatically reduces token usage (70–90%) and is included by default in all presets.

Code executes in a **worker-thread sandbox** — a separate V8 isolate with its own memory space. All `mysql.*` API calls are forwarded to the main thread via a `MessagePort`-based RPC bridge, where the actual database operations execute. This provides:

- **V8 code generation restrictions** — `eval()` and `Function()` construction from strings disabled at the engine level via `codeGeneration: { strings: false, wasm: false }`
- **Frozen prototypes** — all built-in prototypes frozen inside the vm context to prevent dynamic constructor chain escapes
- **18 blocked patterns** — static regex rules blocking `require()`, `process`, `eval()`, `Reflect.*`, `Symbol.*`, `new Proxy()`, and filesystem/network access
- **RPC allowlist** — host-side validation prevents workers from invoking unauthorized API methods
- **Egress boundary enforcement** — result serialization aborted mid-flight when exceeding configurable limit (default 100KB)
- **Readonly enforcement** — when `readonly: true`, write methods return structured errors instead of executing
- **Hard timeouts** — worker termination if execution exceeds the configured limit
- **Full API access** — all 25 tool groups are available via `mysql.*` (e.g., `mysql.core.readQuery()`, `mysql.json.extract()`)

Set `CODEMODE_ISOLATION=vm` to fall back to the in-process `vm` module sandbox if needed.

### ⚡ Code Mode Only (Maximum Token Savings)

If you control your own setup, you can run with **only Code Mode enabled** — a single tool that provides access to all 241 tools' worth of capability through the `mysql.*` API:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--tool-filter",
        "codemode"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_user",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

This exposes just `mysql_execute_code`. The agent writes JavaScript against the typed `mysql.*` SDK — composing queries, chaining operations across all 25 tool groups, and returning exactly the data it needs — in one execution. This mirrors the [Code Mode pattern](https://blog.cloudflare.com/code-mode-mcp/) pioneered by Cloudflare for their entire API: fixed token cost regardless of how many capabilities exist.

> [!TIP]
> **Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using mysql-mcp, prefer `mysql_execute_code` (Code Mode) for multi-step database operations to minimize token usage."_
>
> For maximum savings, use `--tool-filter codemode` to run with Code Mode as your only tool. See the [Code Mode wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Code-Mode) for full API documentation.

---

## 🌐 HTTP/SSE Transport (Remote Access)

For remote access, web-based clients, or HTTP-compatible MCP hosts, use the HTTP transport:

```bash
node dist/cli.js \
  --transport http \
  --port 3000 \
  --mysql "mysql://user:pass@localhost:3306/db"
```

**Docker:**

```bash
docker run --rm -p 3000:3000 \
  -e MYSQL_URL=mysql://user:pass@host:3306/db \
  writenotenow/mysql-mcp:latest \
  --transport http --port 3000
```

The server supports **two MCP transport protocols simultaneously**, enabling both modern and legacy clients to connect:

### Streamable HTTP (Recommended)

Modern protocol (MCP 2025-03-26) — single endpoint, session-based:

| Method   | Endpoint | Purpose                                          |
| -------- | -------- | ------------------------------------------------ |
| `POST`   | `/mcp`   | JSON-RPC requests (initialize, tools/list, etc.) |
| `GET`    | `/mcp`   | SSE stream for server notifications              |
| `DELETE` | `/mcp`   | Session termination                              |

Sessions are managed via the `Mcp-Session-Id header.

### Stateless Mode

For serverless/stateless deployments where sessions are not needed:

```bash
node dist/cli.js --transport http --port 3000 --stateless --mysql "mysql://..."
```

In stateless mode: `GET /mcp` returns 405, `DELETE /mcp` returns 204, `/sse` and `/messages` return 404. Each `POST /mcp` creates a fresh transport.

### Legacy SSE (Backward Compatibility)

Legacy protocol (MCP 2024-11-05) — for clients like Python `mcp.client.sse`:

| Method | Endpoint                   | Purpose                                                       |
| ------ | -------------------------- | ------------------------------------------------------------- |
| `GET`  | `/sse`                     | Opens SSE stream, returns `/messages?sessionId=<id>` endpoint |
| `POST` | `/messages?sessionId=<id>` | Send JSON-RPC messages to the session                         |

### Utility Endpoints

| Method | Endpoint  | Purpose                                                                |
| ------ | --------- | ---------------------------------------------------------------------- |
| `GET`  | `/health` | Health check (bypasses rate limiting, always available for monitoring) |

## 🔐 Authentication

mysql-mcp supports two authentication mechanisms for HTTP transport:

### Simple Bearer Token (`--auth-token`)

Lightweight authentication for development or single-tenant deployments:

```bash
node dist/cli.js --transport http --port 3000 --auth-token my-secret --mysql "mysql://..."

# Or via environment variable
export MCP_AUTH_TOKEN=my-secret
node dist/cli.js --transport http --port 3000 --mysql "mysql://..."
```

Clients must include `Authorization: Bearer my-secret` on all requests. `/health` and `/` are exempt. Unauthenticated requests receive `401` with `WWW-Authenticate: Bearer` headers per RFC 6750.

### OAuth 2.1 (Enterprise)

Full OAuth 2.1 with RFC 9728/8414 compliance for production multi-tenant deployments:

```bash
node dist/cli.js \
  --transport http \
  --port 3000 \
  --mysql "mysql://user:pass@localhost:3306/db" \
  --oauth-enabled \
  --oauth-issuer http://localhost:8080/realms/mysql-mcp \
  --oauth-audience mysql-mcp-client
```

> **Additional flags:** `--oauth-jwks-uri <url>` (auto-discovered if omitted), `--oauth-clock-tolerance <seconds>` (default: 60).

### OAuth Scopes

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

### RFC Compliance

This implementation follows:

- **RFC 9728** — OAuth 2.1 Protected Resource Metadata
- **RFC 8414** — OAuth 2.1 Authorization Server Metadata
- **RFC 7591** — OAuth 2.1 Dynamic Client Registration

The server exposes metadata at `/.well-known/oauth-protected-resource`.

> **Note for Keycloak users:** Add an **Audience mapper** to your client (Client → Client scopes → dedicated scope → Add mapper → Audience) to include the correct `aud` claim in tokens.

> [!NOTE]
> **Per-tool scope enforcement:** Scopes are enforced at the tool level — each tool group maps to a required scope (`read`, `write`, or `admin`). When OAuth is enabled, every tool invocation checks the calling token's scopes before execution. When OAuth is not configured, scope checks are skipped entirely.

> [!WARNING]
> **HTTP without authentication:** When using `--transport http` without enabling OAuth or `--auth-token`, all clients have full unrestricted access. Always enable authentication for production HTTP deployments. See [SECURITY.md](SECURITY.md) for details.

### Cursor IDE / Claude Desktop

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--mysql",
        "mysql://user:password@localhost:3306/database"
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
      "command": "node",
      "args": ["C:/path/to/mysql-mcp/dist/cli.js", "--transport", "stdio"],
      "env": {
        "MYSQL_HOST": "localhost",
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

---

## 🔗 Database Connection Scenarios

| Scenario                  | Host to Use               | Example Connection String                        |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **MySQL on host machine** | `host.docker.internal`    | `mysql://user:pass@host.docker.internal:3306/db` |
| **MySQL in Docker**       | Container name or network | `mysql://user:pass@mysql-container:3306/db`      |
| **Remote/Cloud MySQL**    | Hostname or IP            | `mysql://user:pass@db.example.com:3306/db`       |

### MySQL on Host Machine

If MySQL is installed directly on your computer (via installer, Homebrew, etc.):

```json
"--mysql", "mysql://user:password@host.docker.internal:3306/database"
```

### MySQL in Another Docker Container

Add both containers to the same Docker network, then use the container name:

Create a network and run MySQL:

```bash
docker network create mynet
docker run -d --name mysql-db --network mynet -e MYSQL_ROOT_PASSWORD=pass mysql:8
```

Run MCP server on the same network:

```bash
docker run -i --rm --network mynet writenotenow/mysql-mcp:latest \
  --transport stdio --mysql mysql://root:pass@mysql-db:3306/mysql
```

### Remote/Cloud MySQL (RDS, Cloud SQL, etc.)

Use the remote hostname directly:

```json
"--mysql", "mysql://user:password@your-instance.region.rds.amazonaws.com:3306/database"
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

## 🛠️ Tool Filtering

> [!IMPORTANT]
> **AI IDEs like Cursor have tool limits (typically 40-50 tools).** With 241 tools available, you MUST use tool filtering to stay within your IDE's limits. All shortcuts and tool groups include **Code Mode** (`mysql_execute_code`) by default for token-efficient operations. To exclude it, add `-codemode` to your filter: `--tool-filter core,json,-codemode`

### What Can You Filter?

The `--tool-filter` argument accepts **shortcuts**, **groups**, or **tool names** — mix and match freely:

| Filter Pattern   | Example                     | Tools | Description               |
| ---------------- | --------------------------- | ----- | ------------------------- |
| Shortcut only    | `starter`                   | 39    | Use a predefined bundle   |
| Groups only      | `core,json,transactions`    | 33    | Combine individual groups |
| Shortcut + Group | `starter,spatial`           | 51    | Extend a shortcut         |
| Shortcut - Tool  | `starter,-mysql_drop_table` | 38    | Remove specific tools     |

### Shortcuts (Predefined Bundles)

| Shortcut        | Tools  | Use Case           | What's Included                                                    |
| --------------- | ------ | ------------------ | ------------------------------------------------------------------ |
| `starter`       | **43** | Standard Package   | core, json, transactions, text, codemode                           |
| `essential`     | 20     | Minimal footprint  | core, transactions, codemode                                       |
| `dev-power`     | 67     | Power Developer    | core, schema, performance, stats, fulltext, transactions, codemode |
| `ai-data`       | 50     | AI Data Analyst    | core, json, docstore, text, fulltext, codemode                     |
| `ai-spatial`    | 63     | AI Spatial Analyst | core, spatial, stats, performance, transactions, codemode          |
| `dba-monitor`   | 43     | DBA Monitoring     | core, monitoring, performance, sysschema, optimization, codemode   |
| `dba-manage`    | 43     | DBA Management     | core, admin, backup, replication, partitioning, events, codemode   |
| `dba-secure`    | 37     | DBA Security       | core, security, roles, transactions, codemode                      |
| `dba-schema`    | 36     | DBA Schema         | core, schema, introspection, migration, codemode                   |
| `base-core`     | 54     | Base Ops           | core, json, transactions, text, schema, codemode                   |
| `base-advanced` | 53     | Advanced Features  | docstore, spatial, stats, fulltext, events, codemode               |
| `ecosystem`     | 41     | External Tools     | cluster, proxysql, router, shell, codemode                         |

### Tool Groups (28 Available)

> Note: Tool counts below do NOT include Code Mode (`mysql_execute_code`), which is automatically added to all groups.

| Group           | Tools | Description                                             |
| --------------- | ----- | ------------------------------------------------------- |
| `codemode`      | 1     | Code Mode (sandboxed code execution) 🌟 **Recommended** |
| `core`          | 12    | Read/write queries, tables, indexes                     |
| `transactions`  | 7     | BEGIN, COMMIT, ROLLBACK, savepoints                     |
| `json`          | 17    | JSON functions, merge, diff, stats                      |
| `text`          | 6     | REGEXP, LIKE, SOUNDEX                                   |
| `fulltext`      | 5     | Natural language & boolean search                       |
| `performance`   | 11    | EXPLAIN, query analysis, anomaly detection              |
| `optimization`  | 4     | Index hints, database-wide audits, EXPLAIN recommendations |
| `admin`         | 9     | OPTIMIZE, ANALYZE, CHECK, insights                      |
| `monitoring`    | 7     | PROCESSLIST, status variables                           |
| `backup`        | 7     | Export, import, mysqldump, audit backups                |
| `replication`   | 5     | Master/slave, binlog                                    |
| `partitioning`  | 4     | Partition management                                    |
| `schema`        | 11    | Views, procedures, triggers, constraints                |
| `introspection` | 6     | Dependency graphs, cascade simulation, snapshots        |
| `migration`     | 6     | Schema versioning, apply, rollback, history             |
| `shell`         | 10    | MySQL Shell utilities                                   |
| `events`        | 6     | Event Scheduler management                              |
| `sysschema`     | 8     | sys schema diagnostics                                  |
| `stats`         | 20    | Statistical analysis, window functions, sampling        |
| `spatial`       | 12    | Spatial/GIS operations                                  |
| `security`      | 9     | Audit, SSL, encryption, masking                         |
| `roles`         | 8     | MySQL 8.0 role management                               |
| `docstore`      | 9     | Document Store collections                              |
| `cluster`       | 10    | Group Replication, InnoDB Cluster                       |
| `proxysql`      | 11    | ProxySQL management                                     |
| `router`        | 9     | MySQL Router REST API                                   |
| `vector`        | 11    | Vector embeddings, KNN search, hybrid search (MySQL 9.0+)|

---

### Quick Start: Recommended IDE Configuration

Add one of these configurations to your IDE's MCP settings file (e.g., `cline_mcp_settings.json`, `.cursorrules`, or equivalent):

#### Option 1: Code Mode (Maximum Token Savings, 🌟 Recommended)

**Best for:** General MySQL database work with an AI agent. Exposes a single tool (`mysql_execute_code`) that provides access to all 241 tools via a JavaScript sandbox.

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--tool-filter",
        "codemode"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "your_username",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "your_database"
      }
    }
  }
}
```

#### Option 2: Cluster (11 Tools for InnoDB Cluster Monitoring)

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
      "command": "node",
      "args": [
        "/path/to/mysql-mcp/dist/cli.js",
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
      }
    }
  }
}
```

#### Option 3: Ecosystem (41 Tools for InnoDB Cluster Deployments)

**Best for:** MySQL Router, ProxySQL, MySQL Shell, and InnoDB Cluster deployments.

> **⚠️ Prerequisites:**
>
> - **InnoDB Cluster** with MySQL Router requires the cluster to be running for Router REST API authentication (uses `metadata_cache` backend)
> - Router REST API uses HTTPS with self-signed certificates by default — set `MYSQL_ROUTER_INSECURE=true` to bypass certificate verification
> - **X Protocol:** InnoDB Cluster includes the MySQL X Plugin by default. Set `MYSQL_XPORT` to the Router's X Protocol port (e.g., `6448`) for `mysqlsh_import_json` and `docstore` tools
> - See [MySQL Ecosystem Setup Guide](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Ecosystem-Setup) for detailed instructions

```json
{
  "mcpServers": {
    "mysql-mcp-ecosystem": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp/dist/cli.js",
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
      }
    }
  }
}
```

**Customization Notes:**

- Replace `/path/to/mysql-mcp/` with your actual installation path
- Update credentials with your actual values
- For Windows: Use forward slashes (e.g., `C:/mysql-mcp/dist/cli.js`) or escape backslashes
- For Windows MySQL Shell: `"MYSQLSH_PATH": "C:\\Program Files\\MySQL\\MySQL Shell 9.5\\bin\\mysqlsh.exe"`
- **Router Authentication:** Router REST API authenticates against the InnoDB Cluster metadata. The cluster must be running for authentication to work.
- **Cluster Resource:** The `mysql://cluster` resource is only available when connected to an InnoDB Cluster node

---

**Legacy Syntax (still supported):**
If you start with a negative filter (e.g., `-ecosystem`), it assumes you want to start with _all_ tools enabled and then subtract.

### Syntax Reference

| Prefix   | Target   | Example             | Effect                                        |
| -------- | -------- | ------------------- | --------------------------------------------- |
| _(none)_ | Shortcut | `starter`           | **Whitelist Mode:** Enable ONLY this shortcut |
| _(none)_ | Group    | `core`              | **Whitelist Mode:** Enable ONLY this group    |
| _(none)_ | Tool     | `mysql_read_query`  | **Whitelist Mode:** Enable ONLY this tool     |
| `+`      | Group    | `+spatial`          | Add tools from this group to current set      |
| `-`      | Group    | `-admin`            | Remove tools in this group from current set   |
| `+`      | Tool     | `+mysql_explain`    | Add one specific tool                         |
| `-`      | Tool     | `-mysql_drop_table` | Remove one specific tool                      |

### Custom Tool Selection

You can list individual tool names (without `+` prefix) to create a fully custom whitelist — only the tools you specify will be enabled:

```bash
# Enable exactly 3 tools (whitelist mode)
--tool-filter "mysql_read_query,mysql_write_query,mysql_list_tables"

# Mix tools from different groups
--tool-filter "mysql_read_query,mysql_explain,mysql_json_extract"

# Combine with a shortcut or group
--tool-filter "starter,+mysql_spatial_distance,+mysql_json_diff"
```

This is useful for scripted or automated clients that need a minimal, precise set of capabilities.

> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for advanced examples.

---

## 🤖 AI-Powered Prompts

This server includes **19 intelligent prompts** for guided workflows:

| Prompt                        | Description                                            |
| ----------------------------- | ------------------------------------------------------ |
| `mysql_query_builder`         | Construct SQL queries with security best practices     |
| `mysql_schema_design`         | Design table schemas with indexes and relationships    |
| `mysql_performance_analysis`  | Analyze slow queries with optimization recommendations |
| `mysql_migration`             | Generate migration scripts with rollback options       |
| `mysql_database_health_check` | Comprehensive database health assessment               |
| `mysql_backup_strategy`       | Enterprise backup planning with RTO/RPO                |
| `mysql_index_tuning`          | Index analysis and optimization workflow               |
| `mysql_setup_router`          | MySQL Router configuration guide                       |
| `mysql_setup_proxysql`        | ProxySQL configuration guide                           |
| `mysql_setup_replication`     | Replication setup guide                                |
| `mysql_setup_shell`           | MySQL Shell usage guide                                |
| `mysql_tool_index`            | Complete tool index with categories                    |
| `mysql_quick_query`           | Quick query execution shortcut                         |
| `mysql_quick_schema`          | Quick schema exploration                               |
| **`mysql_setup_events`**      | Event Scheduler setup guide                            |
| **`mysql_sys_schema_guide`**  | sys schema usage and diagnostics                       |
| **`mysql_setup_spatial`**     | Spatial/GIS data setup guide                           |
| **`mysql_setup_cluster`**     | InnoDB Cluster/Group Replication guide                 |
| **`mysql_setup_docstore`**    | Document Store / X DevAPI guide                        |

---

## 📊 Resources

This server exposes **19 resources** for database observability:

| Resource                | Description                                 |
| ----------------------- | ------------------------------------------- |
| `mysql://schema`        | Full database schema                        |
| `mysql://tables`        | Table listing with metadata                 |
| `mysql://variables`     | Server configuration variables              |
| `mysql://status`        | Server status metrics                       |
| `mysql://processlist`   | Active connections and queries              |
| `mysql://pool`          | Connection pool statistics                  |
| `mysql://capabilities`  | Server version, features, tool categories   |
| `mysql://health`        | Comprehensive health status                 |
| `mysql://performance`   | Query performance metrics                   |
| `mysql://indexes`       | Index usage and statistics                  |
| `mysql://replication`   | Replication status and lag                  |
| `mysql://innodb`        | InnoDB buffer pool and engine metrics       |
| **`mysql://events`**    | Event Scheduler status and scheduled events |
| **`mysql://sysschema`** | sys schema diagnostics summary              |
| **`mysql://locks`**     | InnoDB lock contention detection            |
| **`mysql://cluster`**   | Group Replication/InnoDB Cluster status     |
| **`mysql://spatial`**   | Spatial columns and indexes                 |
| **`mysql://docstore`**  | Document Store collections                  |
| **`mysql://metrics`**   | Real-time observability metrics             |

---

## 🔧 Advanced Configuration

> **Tip:** You can now configure the server using native JSON or YAML configuration files via the `--config <path>` flag. Precedence follows: CLI Flags > Environment Variables > Config File > Defaults. See the `server-config-example.yaml` and `server-config-example.json` templates at the root of the project for setup details.

For specialized setups, see these Wiki pages:

| Topic                                                                        | Description                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| [MySQL Router](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Router) | Configure Router REST API access for InnoDB Cluster |
| [ProxySQL](https://github.com/neverinfamous/mysql-mcp/wiki/ProxySQL)         | Configure ProxySQL admin interface access           |
| [MySQL Shell](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Shell)   | Configure MySQL Shell for dump/load operations      |

---

## ⚡ Performance Tuning

Schema metadata is cached to reduce repeated queries during tool/resource invocations.

| Variable                    | Default  | Description                                                         |
| --------------------------- | -------- | ------------------------------------------------------------------- |
| `METADATA_CACHE_TTL_MS`     | `30000`  | Cache TTL for schema metadata (milliseconds)                        |
| `LOG_LEVEL`                 | `info`   | Log verbosity: `debug`, `info`, `warning`, `error`                  |
| `CODE_MODE_MAX_RESULT_SIZE` | `102400` | Maximum Code Mode result payload in bytes (default 100KB, cap 50MB) |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `5000`), or increase it for production with stable schemas (e.g., `300000` = 5 min).

> **Built-in payload optimization:** Many tools support optional `summary: true` for condensed responses and `limit` parameters to cap result sizes. These are particularly useful for cluster status, monitoring, and sys schema tools where full responses can be large. See the code map for per-tool details.

---

### CLI Options

| Option                    | Environment Variable    | Description                                         |
| ------------------------- | ----------------------- | --------------------------------------------------- |
| `--config`                | —                       | Configuration file path (.yaml or .json)            |
| `--server-host`           | `MCP_HOST`              | Host to bind HTTP transport to (default: localhost) |
| `--auth-token`            | `MCP_AUTH_TOKEN`        | Simple bearer token for HTTP authentication         |
| `--stateless`             | —                       | Enable stateless HTTP mode (no sessions, no SSE)    |
| `--trust-proxy`           | `TRUST_PROXY`           | Trust X-Forwarded-For for client IP                 |
| `--log-level`             | `LOG_LEVEL`             | Log level: debug, info, warn, error                 |
| `--allowed-io-roots`      | `ALLOWED_IO_ROOTS`      | JSON array or comma list of allowed paths for HTTP/SSE and shell tools |
| `--oauth-enabled`         | `OAUTH_ENABLED`         | Enable OAuth 2.1 authentication                     |
| `--oauth-issuer`          | `OAUTH_ISSUER`          | Authorization server URL                            |
| `--oauth-audience`        | `OAUTH_AUDIENCE`        | Expected token audience                             |
| `--oauth-jwks-uri`        | `OAUTH_JWKS_URI`        | JWKS URI (auto-discovered)                          |
| `--oauth-clock-tolerance` | `OAUTH_CLOCK_TOLERANCE` | Clock tolerance in seconds                          |

> **Priority:** When both `--auth-token` and `--oauth-enabled` are set, OAuth 2.1 takes precedence. If neither is configured, the server warns and runs without authentication.

### Scopes

| Scope   | Access Level              |
| ------- | ------------------------- |
| `read`  | Read-only queries         |
| `write` | Read + write operations   |
| `admin` | Administrative operations |
| `full`  | All operations            |

> **📖 See the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth)** for Keycloak setup and detailed configuration.

## Development

See **[From Source](#from-source)** above for setup. After cloning:

```bash
pnpm run lint && pnpm run typecheck  # Run checks
pnpm test                            # Run tests
```

### MCP Inspector

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

Open **http://localhost:6274** to browse all 241 tools, 19 resources, and 19 prompts interactively.

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

### Unit Testing

The project maintains high test coverage (~90%) using Vitest.

```bash
npm test
```

Run coverage report:

```bash
npm run test:coverage
```

**Test Infrastructure:**

- Centralized mock factories in `src/__tests__/mocks/`
- All 111 test files use shared mocks for consistency
- Tests run without database connection (fully mocked)

### Benchmarking

The project includes a performance benchmarking suite to track the efficiency of critical paths like Code Mode sandbox initialization, tool filtering, and URI routing.

```bash
npm run bench
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Security

For security concerns, please see our [Security Policy](SECURITY.md).

> **⚠️ Never commit credentials** - Store secrets in `.env` (gitignored)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.

# mysql-mcp

<!-- mcp-name: io.github.neverinfamous/mysql-mcp -->

[![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)](https://github.com/neverinfamous/mysql-mcp) [![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp) [![Docker Pulls](https://img.shields.io/docker/pulls/neverinfamous/mysql-mcp)](https://hub.docker.com/r/neverinfamous/mysql-mcp)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## 💎 Value Proposition

- ⚡ **Build AI Integrations Instantly:** Accelerate development with plug-and-play architecture.
- 🛡️ **Enterprise-Grade Security:** Fortify your data with robust OAuth 2.1 authentication and strict access controls.
- 🚀 **Blazing-Fast Code Mode:** Execute complex, sandboxed logic directly within the worker-thread for 70-90% token savings.
- 📈 **Massive Scalability:** Scale operations effortlessly with high-performance connection pooling.
- 🐳 **Production-Ready Docker:** Deploy seamlessly with comprehensive containerized environments.
- 🧠 **Agent-Empowered Data:** Give autonomous agents zero-hallucination, secure database introspection.

## 🎯 Core Benefits

| Feature                               | Description                                                                                                                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Specialized Tools**                 | Access 241 specialized tools. Manage core CRUD, JSON, spatial data, document stores, and clusters. |
| **23 Resources**                     | Monitor schema, performance metrics, process lists, replication status, and InnoDB diagnostics in real-time. |
| **19 AI-Powered Prompts**            | Execute guided workflows for query building, schema design, performance tuning, and infrastructure setup. |
| **Code Mode**                         | Execute operations locally inside a V8 isolate. Reduce LLM token overhead by up to 90%. |
| **Token-Optimized Payloads**          | Maximize token efficiency. Use optional flags to reduce response size for large payloads. |
| **OAuth 2.1 Security**                | Enforce granular access control with RFC compliance, strict scopes, and Keycloak integration. |
| **Smart Tool Filtering**              | Use 28 groups and 16 shortcuts to stay within IDE tool limits. |
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

- Node.js 24+
- MySQL 5.7, 8.0+, or 9.x (supported with limitations regarding Shell driver versions) server
- pnpm

### Install the Server

#### NPM / PNPM (Recommended)

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
docker run -i --rm neverinfamous/mysql-mcp:latest \
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

## ⚡ Maximize Efficiency with Code Mode

Code Mode (`mysql_execute_code`) dramatically reduces token usage. It is included by default.

Code executes in a **C++ V8 isolate sandbox**. It uses a physically separate V8 isolate via `isolated-vm`. It enforces strict heap limits and synchronous termination. It maps all `mysql.*` API calls through the boundary using native wrappers. This provides:

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

## 🌐 Connect Remotely via HTTP/SSE

Use the HTTP transport for remote access:

```bash
node dist/cli.js \
  --transport http \
  --server-host 0.0.0.0 \
  --port 3000 \
  --mysql "mysql://user:pass@localhost:3306/db"
```

**Docker:**

```bash
docker run --rm -p 3000:3000 \
  neverinfamous/mysql-mcp:latest \
  --transport http --server-host 0.0.0.0 --port 3000 --mysql "mysql://user:pass@host.docker.internal:3306/db"
```

The server supports **two MCP transport protocols simultaneously**. Both modern and legacy clients can connect:

### Streamable HTTP (Recommended)

Modern protocol (MCP 2024-11-05) — single endpoint, session-based:

| Method   | Endpoint | Purpose                                          |
| -------- | -------- | ------------------------------------------------ |
| `POST`   | `/mcp`   | JSON-RPC requests (initialize, tools/list, etc.) |
| `GET`    | `/mcp`   | SSE stream for server notifications              |
| `DELETE` | `/mcp`   | Session termination                              |

> **Rate Limit:** HTTP transport is limited to 100 requests per minute per IP.

Sessions are managed via the `Mcp-Session-Id` header.

### Run Statelessly

Use stateless deployments where sessions are not needed:

```bash
node dist/cli.js --transport http --server-host 0.0.0.0 --port 3000 --stateless --mysql "mysql://..."
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

## 🔐 Secure Access with Authentication

mysql-mcp supports two authentication mechanisms for HTTP transport:

### Simple Bearer Token (`--auth-token`)

Use lightweight authentication for development:

```bash
node dist/cli.js --transport http --server-host 0.0.0.0 --port 3000 --auth-token my-secret --mysql "mysql://..."

# Or via environment variable
export MCP_AUTH_TOKEN=my-secret
node dist/cli.js --transport http --server-host 0.0.0.0 --port 3000 --mysql "mysql://..."
```

Clients must include `Authorization: Bearer my-secret` on all requests. `/health` and `/` are exempt. Unauthenticated requests receive `401` with `WWW-Authenticate: Bearer` headers per RFC 6750.

### OAuth 2.1 (Enterprise)

Use full OAuth 2.1 for production deployments:

```bash
node dist/cli.js \
  --transport http \
  --server-host 0.0.0.0 \
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

> **Note for Keycloak users:** Add an **Audience mapper** to your client. This includes the correct `aud` claim. (Client → Client scopes → dedicated scope → Add mapper → Audience)

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

## 🔗 Connect to Any Database

| Scenario                  | Host to Use               | Example Connection String                        |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **MySQL on host machine** | `host.docker.internal`    | `mysql://user:pass@host.docker.internal:3306/db` |
| **MySQL in Docker**       | Container name or network | `mysql://user:pass@mysql-container:3306/db`      |
| **Remote/Cloud MySQL**    | Hostname or IP            | `mysql://user:pass@db.example.com:3306/db`       |

### MySQL on Host Machine

If MySQL is installed directly on your computer (via installer, Homebrew, etc.):

```json
[
  "--mysql",
  "mysql://user:password@host.docker.internal:3306/database"
]
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
docker run -i --rm --network mynet neverinfamous/mysql-mcp:latest \
  --transport stdio --mysql mysql://root:pass@mysql-db:3306/mysql
```

### Remote/Cloud MySQL (RDS, Cloud SQL, etc.)

Use the remote hostname directly:

```json
[
  "--mysql",
  "mysql://user:password@your-instance.region.rds.amazonaws.com:3306/database"
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

## 🛠️ Optimize Limits with Tool Filtering

> [!IMPORTANT]
> **AI IDEs like Cursor have tool limits (typically 40-50 tools).** With 241 tools available, you MUST use tool filtering. This keeps you within your IDE's limits. All shortcuts and tool groups include **Code Mode** by default. To exclude it, add `-codemode` to your filter: `--tool-filter core,json,-codemode`

### What Can You Filter?

The `--tool-filter` argument accepts **shortcuts**, **groups**, or **tool names** — mix and match freely:

| Filter Pattern   | Example                     | Tools | Description               |
| ---------------- | --------------------------- | ----- | ------------------------- |
| Shortcut only    | `starter`                   | 43    | Use a predefined bundle   |
| Groups only      | `core,json,transactions`    | 36    | Combine individual groups |
| Shortcut + Group | `starter,spatial`           | 55    | Extend a shortcut         |
| Shortcut - Tool  | `starter,-mysql_drop_table` | 42    | Remove specific tools     |

### Shortcuts (Predefined Bundles)

| Shortcut        | Tools  | Use Case           | What's Included                                                    |
| --------------- | ------ | ------------------ | ------------------------------------------------------------------ |
| `starter`         | **43** | Standard Package    | core, json, transactions, text, codemode                         |
| `essential`       | 20     | Minimal footprint   | core, transactions, codemode                                     |
| `dev-power`       | 47     | Power Developer     | core, schema, performance, fulltext, transactions, codemode      |
| `dev-analytics`   | 44     | Developer Analytics | core, stats, performance, codemode                               |
| `ai-data-nosql`   | 39     | AI Data NoSQL       | core, json, docstore, codemode                                   |
| `ai-search`       | 35     | AI Search           | core, text, fulltext, vector, codemode                           |
| `ai-spatial`      | 32     | AI Spatial Analyst  | core, spatial, transactions, codemode                            |
| `ai-vector`       | 29     | AI Vector Analyst   | core, vector, fulltext, codemode                                 |
| `dba-monitor`     | 43     | DBA Monitoring      | core, monitoring, performance, sysschema, optimization, codemode |
| `dba-manage`      | 44     | DBA Management      | core, admin, backup, replication, partitioning, events, codemode |
| `dba-secure`      | 37     | DBA Security        | core, security, roles, transactions, codemode                    |
| `dba-schema`      | 36     | DBA Schema          | core, schema, introspection, migration, codemode                 |
| `base-relational` | 37     | Base Relational     | core, transactions, text, schema, codemode                       |
| `base-analytics`  | 27     | Base Analytics      | stats, events, codemode                                          |
| `base-nosql`      | 33     | Base NoSQL          | docstore, spatial, vector, codemode                              |
| `ecosystem`       | 41     | External Tools      | cluster, proxysql, router, shell, codemode                       |

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

Add one of these configurations to your IDE's MCP settings file (e.g., `cline_mcp_settings.json`, `.cursor/mcp.json`, or equivalent):

#### Option 1: Code Mode (Maximum Token Savings, 🌟 Recommended)

**Best for:** General MySQL database work with an AI agent. Exposes a single tool (`mysql_execute_code`) that provides access to its full toolset via a JavaScript sandbox.

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
If you start with a negative filter (e.g., `-ecosystem`), it enables all tools first. It then subtracts the specified tools.

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

The easiest way to filter is using **whitelist mode**. Simply specify the shortcut you want. Everything else is automatically disabled.
> **Architectural Rule:** Tool filtering allows skipping the `--mysql` connection. Do this if only ecosystem tools (`router`, `proxysql`, `shell`) are used.

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

## 🤖 Automate Workflows with AI Prompts

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

## 📊 Monitor Health with Resources

This server exposes **23 resources** for database observability and telemetry:

| Resource                | Description                                 |
| ----------------------- | ------------------------------------------- |
| `mysql://schema`        | Full database schema                        |
| `mysql://tables`        | Table listing with metadata                 |
| `mysql://table/{name}`  | Specific Table Schema                       |
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
| `mysql://cluster`       | Group Replication/InnoDB Cluster status     |
| `mysql://spatial`       | Spatial columns and indexes                 |
| `mysql://docstore`      | Document Store collections                  |
| `mysql://insights`      | Business insights memo from mysql_append_insight |
| `mysql://audit-log`     | Forensic audit trail and pre-mutation snapshot stats |
| `mysql://metrics`       | In-memory streaming telemetry (p50/p95/p99 latency) |
| `mysql://help`          | Critical gotchas, parameter aliases, and API reference |

---

## 🔧 Customize with Advanced Configuration

> **Tip:** You can now configure the server using native JSON or YAML configuration files via the `--config <path>` flag. Precedence follows: CLI Flags > Environment Variables > Config File > Defaults. See the `server-config-example.yaml` and `server-config-example.json` templates at the root of the project for setup details.

For specialized setups, see these Wiki pages:

| Topic                                                                        | Description                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| [MySQL Router](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Router) | Configure Router REST API access for InnoDB Cluster |
| [ProxySQL](https://github.com/neverinfamous/mysql-mcp/wiki/ProxySQL)         | Configure ProxySQL admin interface access           |
| [MySQL Shell](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Shell)   | Configure MySQL Shell for dump/load operations      |

---

## ⚡ Boost Speed with Performance Tuning

Schema metadata is cached to reduce repeated queries during tool/resource invocations.

| Variable                    | Default  | Description                                                         |
| --------------------------- | -------- | ------------------------------------------------------------------- |
| `METADATA_CACHE_TTL_MS`     | `30000`  | Cache TTL for schema metadata (milliseconds)                        |
| `LOG_LEVEL`                 | `info`   | Log verbosity: `debug`, `info`, `warn`, `error`                     |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `5000`), or increase it for production with stable schemas (e.g., `300000` = 5 min).

> **Built-in payload optimization:** Many tools support optional `summary: true` for condensed responses and `limit` parameters to cap result sizes. These are particularly useful for cluster status, monitoring, and sys schema tools where full responses can be large. See the code map for per-tool details.

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
| `--pool-timeout`          | —                       | Connection acquire timeout in ms (default: 10000)   |
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

## 💻 Extend and Contribute

See **[From Source](#from-source)** above for setup. After cloning:

```bash
pnpm run check  # Run lint, typecheck, unit tests, and E2E tests
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

Open **http://localhost:5173** to browse all 241 tools, 23 resources, and 19 prompts interactively.

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
pnpm test
```

Run coverage report:

```bash
pnpm run test:coverage
```

**Test Infrastructure:**

- Centralized mock factories in `src/__tests__/mocks/`
- All 111 test files use shared mocks for consistency
- Tests run without database connection (fully mocked)

### Benchmarking

The project includes a performance benchmarking suite to track the efficiency of critical paths like Code Mode sandbox initialization, tool filtering, and URI routing.

```bash
pnpm run bench
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

# MySQL MCP Server

**Last Updated February 26, 2026**

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/mysql--mcp-blue?logo=github)](https://github.com/neverinfamous/mysql-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CodeQL](https://github.com/neverinfamous/mysql-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/neverinfamous/mysql-mcp/actions/workflows/codeql.yml)
[![npm version](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp.svg)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)
![Tests](https://img.shields.io/badge/Tests-2169%20passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/Coverage-90%25-brightgreen.svg)

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/mysql-mcp/blob/main/CHANGELOG.md)** • **[Security](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## The Most Comprehensive MySQL MCP Server Available

**mysql-mcp** is the definitive **Model Context Protocol server for MySQL** — empowering AI assistants like AntiGravity, Claude, Cursor, and other MCP clients with **unparalleled database capabilities**, **deterministic error handling**, and **process-isolated sandboxed code execution**. Built for developers who demand enterprise-grade features without sacrificing ease of use.

### 🎯 What Sets Us Apart

| Feature                          | Description                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **192 Specialized Tools**        | The largest MySQL tool collection for MCP — from core CRUD and native JSON functions (MySQL 5.7+) to advanced spatial/GIS, document store, and cluster management                              |
| **18 Observability Resources**   | Real-time schema, performance metrics, process lists, status variables, replication status, and InnoDB diagnostics                                                                             |
| **19 AI-Powered Prompts**        | Guided workflows for query building, schema design, performance tuning, and infrastructure setup                                                                                               |
| **OAuth 2.1 + Access Control**   | Enterprise-ready security with RFC 9728/8414 compliance, granular scopes (`read`, `write`, `admin`, `full`, `db:*`, `table:*:*`), and Keycloak integration                                     |
| **Smart Tool Filtering**         | 25 tool groups + 11 shortcuts let you stay within IDE limits while exposing exactly what you need                                                                                              |
| **HTTP Streaming Transport**     | SSE-based streaming with `/sse`, `/messages`, and `/health` endpoints for remote deployments                                                                                                   |
| **High-Performance Pooling**     | Built-in connection pooling for efficient, concurrent database access                                                                                                                          |
| **Ecosystem Integrations**       | First-class support for **MySQL Router**, **ProxySQL**, and **MySQL Shell** utilities                                                                                                          |
| **Advanced Encryption**          | Full TLS/SSL support for secure connections, plus tools for managing data masking, encryption monitoring, and compliance                                                                       |
| **Deterministic Error Handling** | Every tool returns structured `{success, error}` responses — no raw exceptions, no silent failures, no misleading messages. Agents get actionable context instead of cryptic MySQL error codes |
| **Production-Ready Security**    | SQL injection protection, parameterized queries, input validation, and audit capabilities                                                                                                      |
| **Worker Sandbox Isolation**     | Code Mode executes in a separate V8 isolate via `worker_threads` with a `MessagePort` RPC bridge, enforced memory limits, readonly mode, and hard timeouts                                     |
| **Strict TypeScript**            | 100% type-safe codebase with 2169 tests and 90% coverage                                                                                                                                       |
| **MCP 2025-11-25 Compliant**     | Full protocol support with tool safety hints, resource priorities, and progress notifications                                                                                                  |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 24+
- MySQL 5.7+ or 8.0+ server
- npm or yarn

### Installation

#### NPM (Recommended)

```bash
npm install -g @neverinfamous/mysql-mcp
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
npm install
npm run build
node dist/cli.js --transport stdio --mysql mysql://user:password@localhost:3306/database
```

---

## Code Mode: Maximum Efficiency

Code Mode (`mysql_execute_code`) dramatically reduces token usage (70–90%) and is included by default in all presets.

Code executes in a **worker-thread sandbox** — a separate V8 isolate with its own memory space. All `mysql.*` API calls are forwarded to the main thread via a `MessagePort`-based RPC bridge, where the actual database operations execute. This provides:

- **Process-level isolation** — user code runs in a separate V8 instance with enforced heap limits
- **Readonly enforcement** — when `readonly: true`, write methods return structured errors instead of executing
- **Hard timeouts** — worker termination if execution exceeds the configured limit
- **Full API access** — all 24 tool groups are available via `mysql.*` (e.g., `mysql.core.readQuery()`, `mysql.json.extract()`)

Set `CODEMODE_ISOLATION=vm` to fall back to the in-process `vm` module sandbox if needed.

### ⚡ Code Mode Only (Maximum Token Savings)

If you control your own setup, you can run with **only Code Mode enabled** — a single tool that provides access to all 192 tools' worth of capability through the `mysql.*` API:

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

This exposes just `mysql_execute_code`. The agent writes JavaScript against the typed `mysql.*` SDK — composing queries, chaining operations across all 24 tool groups, and returning exactly the data it needs — in one execution. This mirrors the [Code Mode pattern](https://blog.cloudflare.com/code-mode-mcp/) pioneered by Cloudflare for their entire API: fixed token cost regardless of how many capabilities exist.

> [!TIP]
> **Maximize Token Savings:** Instruct your AI agent to prefer Code Mode over individual tool calls:
>
> _"When using mysql-mcp, prefer `mysql_execute_code` (Code Mode) for multi-step database operations to minimize token usage."_
>
> For maximum savings, use `--tool-filter codemode` to run with Code Mode as your only tool. See the [Code Mode wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Code-Mode) for full API documentation.

> [!NOTE]
> **AntiGravity Users:** Server instructions are automatically sent to MCP clients during initialization. However, AntiGravity does not currently support MCP server instructions. For optimal Code Mode usage in AntiGravity, manually provide the contents of [`src/constants/ServerInstructions.ts`](https://github.com/neverinfamous/mysql-mcp/blob/main/src/constants/ServerInstructions.ts) to the agent in your prompt or user rules.

---

## ⚡ MCP Client Configuration

### HTTP/SSE Server Usage (Advanced)

> **When to use HTTP mode:** Use HTTP mode when deploying `mysql-mcp` as a standalone server that multiple clients can connect to remotely. For local development with Claude Desktop or Cursor IDE, use the default `stdio` mode shown below instead.

**Use cases for HTTP mode:**

- Running the server in a Docker container accessible over a network
- Deploying to cloud platforms (AWS, GCP, Azure)
- Enabling OAuth 2.1 authentication for enterprise security
- Allowing multiple AI clients to share one database connection

## OAuth 2.1 Authentication

For enterprise deployments, mysql-mcp supports OAuth 2.1 authentication with Keycloak or any RFC-compliant provider.

### Quick Setup

**1. Start with OAuth disabled (default)**

```bash
mysql-mcp --mysql mysql://root:pass@localhost/db
```

**2. Enable OAuth with an identity provider**

```bash
mysql-mcp --mysql mysql://root:pass@localhost/db \
          --oauth-enabled \
          --oauth-issuer http://localhost:8080/realms/mysql-mcp \
          --oauth-audience mysql-mcp
```

**Start the HTTP server:**

Local installation:

```bash
node dist/cli.js --transport http --port 3000 --server-host 0.0.0.0 --mysql mysql://user:password@localhost:3306/database
```

Docker (expose port 3000):

```bash
docker run -p 3000:3000 writenotenow/mysql-mcp \
  --transport http \
  --port 3000 \
  --server-host 0.0.0.0 \
  --mysql mysql://user:password@host.docker.internal:3306/database
```

**Available endpoints:**

- `GET /sse` - Establish MCP connection via Server-Sent Events
- `POST /messages` - Send JSON-RPC messages to the server
- `GET /health` - Health check endpoint
- `GET /.well-known/oauth-protected-resource` - OAuth 2.1 metadata (when OAuth enabled)

> **💡 Tip:** Most users should skip this section and use the stdio configuration below for local AI IDE integration.

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

> **Note:** `MYSQL_XPORT` (X Protocol port) defaults to `33060` if omitted. Only needed for `mysqlsh_import_json` and `docstore` tools. Set to your MySQL Router X Protocol port (e.g., `6448`) when using InnoDB Cluster.
```

> **📖 See the [Configuration Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Configuration)** for more configuration options.

---

## 🔗 Database Connection Scenarios

| Scenario                  | Host to Use               | Example Connection String                        |
| ------------------------- | ------------------------- | ------------------------------------------------ |
| **MySQL on host machine** | `host.docker.internal`    | `mysql://user:pass@host.docker.internal:3306/db` |
| **MySQL in Docker**       | Container name or network | `mysql://user:pass@mysql-container:3306/db`      |
| **Remote/Cloud MySQL**    | Hostname or IP            | `mysql://user:pass@db.example.com:3306/db`       |

> **Tip:** For remote connections, ensure your MySQL server allows connections from Docker's IP range and that firewalls/security groups permit port 3306.

---

## 🛠️ Tool Filtering

> [!IMPORTANT]
> **AI IDEs like Cursor have tool limits (typically 40-50 tools).** With 192 tools available, you MUST use tool filtering to stay within your IDE's limits. We recommend `starter` (39 tools) as a starting point. Code Mode is included in all presets by default for 70-90% token savings on multi-step operations.

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
| `starter`       | **39** | 🌟 **Recommended** | core, json, transactions, text, codemode                           |
| `essential`     | 16     | Minimal footprint  | core, transactions, codemode                                       |
| `dev-power`     | 47     | Power Developer    | core, schema, performance, stats, fulltext, transactions, codemode |
| `ai-data`       | 46     | AI Data Analyst    | core, json, docstore, text, fulltext, codemode                     |
| `ai-spatial`    | 44     | AI Spatial Analyst | core, spatial, stats, performance, transactions, codemode          |
| `dba-monitor`   | 36     | DBA Monitoring     | core, monitoring, performance, sysschema, optimization, codemode   |
| `dba-manage`    | 34     | DBA Management     | core, admin, backup, replication, partitioning, events, codemode   |
| `dba-secure`    | 33     | DBA Security       | core, security, roles, transactions, codemode                      |
| `base-core`     | 49     | Base Ops           | core, json, transactions, text, schema, codemode                   |
| `base-advanced` | 41     | Advanced Features  | docstore, spatial, stats, fulltext, events, codemode               |
| `ecosystem`     | 41     | External Tools     | cluster, proxysql, router, shell, codemode                         |

### Tool Groups (25 Available)

| Group          | Tools | Description                              |
| -------------- | ----- | ---------------------------------------- |
| `core`         | 8     | Read/write queries, tables, indexes      |
| `transactions` | 7     | BEGIN, COMMIT, ROLLBACK, savepoints      |
| `json`         | 17    | JSON functions, merge, diff, stats       |
| `text`         | 6     | REGEXP, LIKE, SOUNDEX                    |
| `fulltext`     | 5     | Natural language & boolean search        |
| `performance`  | 8     | EXPLAIN, query analysis, slow queries    |
| `optimization` | 4     | Index hints, recommendations             |
| `admin`        | 6     | OPTIMIZE, ANALYZE, CHECK                 |
| `monitoring`   | 7     | PROCESSLIST, status variables            |
| `backup`       | 4     | Export, import, mysqldump                |
| `replication`  | 5     | Master/slave, binlog                     |
| `partitioning` | 4     | Partition management                     |
| `schema`       | 10    | Views, procedures, triggers, constraints |
| `shell`        | 10    | MySQL Shell utilities                    |
| `events`       | 6     | Event Scheduler management               |
| `sysschema`    | 8     | sys schema diagnostics                   |
| `stats`        | 8     | Statistical analysis tools               |
| `spatial`      | 12    | Spatial/GIS operations                   |
| `security`     | 9     | Audit, SSL, encryption, masking          |
| `roles`        | 8     | MySQL 8.0 role management                |
| `docstore`     | 9     | Document Store collections               |
| `cluster`      | 10    | Group Replication, InnoDB Cluster        |
| `proxysql`     | 11    | ProxySQL management                      |
| `router`       | 9     | MySQL Router REST API                    |
| `codemode`     | 1     | Sandboxed code execution                 |

---

> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for IDE configuration examples and advanced usage.

---

## 💡 Usage Instructions

> [!NOTE]
> Usage instructions are **automatically provided** to AI agents via the MCP protocol during server initialization.

For debugging or manual reference, see the source: [`src/constants/ServerInstructions.ts`](src/constants/ServerInstructions.ts)

---

## 🤖 AI-Powered Prompts

**19 intelligent prompts** for guided workflows including query building, schema design, performance analysis, migration planning, backup strategy, index tuning, and ecosystem setup (Router, ProxySQL, Replication, Shell, Cluster, Spatial, Events, Document Store).

---

## 📊 Resources

**18 real-time resources** for database observability: schema, tables, variables, status, processlist, connection pool, capabilities, health, performance, indexes, replication, InnoDB metrics, events, sys schema, locks, cluster status, spatial metadata, and document store collections.

---

## 🔧 Advanced Configuration

For specialized setups, see these Wiki pages:

| Topic                                                                        | Description                                         |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| [MySQL Router](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Router) | Configure Router REST API access for InnoDB Cluster |
| [ProxySQL](https://github.com/neverinfamous/mysql-mcp/wiki/ProxySQL)         | Configure ProxySQL admin interface access           |
| [MySQL Shell](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Shell)   | Configure MySQL Shell for dump/load operations      |

---

## ⚡ Performance Tuning

Schema metadata is cached to reduce repeated queries during tool/resource invocations.

| Variable                | Default | Description                                        |
| ----------------------- | ------- | -------------------------------------------------- |
| `METADATA_CACHE_TTL_MS` | `30000` | Cache TTL for schema metadata (milliseconds)       |
| `LOG_LEVEL`             | `info`  | Log verbosity: `debug`, `info`, `warning`, `error` |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `5000`), or increase it for production with stable schemas (e.g., `300000` = 5 min).

> **Built-in payload optimization:** Many tools support optional `summary: true` for condensed responses and `limit` parameters to cap result sizes. These are particularly useful for cluster status, monitoring, and sys schema tools where full responses can be large. See [`ServerInstructions.ts`](https://github.com/neverinfamous/mysql-mcp/blob/main/src/constants/ServerInstructions.ts) for per-tool details.

---

### CLI Options

| Option                    | Environment Variable    | Description                                         |
| ------------------------- | ----------------------- | --------------------------------------------------- |
| `--server-host`           | `MCP_HOST`              | Host to bind HTTP transport to (default: localhost) |
| `--oauth-enabled`         | `OAUTH_ENABLED`         | Enable OAuth authentication                         |
| `--oauth-issuer`          | `OAUTH_ISSUER`          | Authorization server URL                            |
| `--oauth-audience`        | `OAUTH_AUDIENCE`        | Expected token audience                             |
| `--oauth-jwks-uri`        | `OAUTH_JWKS_URI`        | JWKS URI (auto-discovered)                          |
| `--oauth-clock-tolerance` | `OAUTH_CLOCK_TOLERANCE` | Clock tolerance in seconds                          |

### Scopes

| Scope   | Access Level              |
| ------- | ------------------------- |
| `read`  | Read-only queries         |
| `write` | Read + write operations   |
| `admin` | Administrative operations |
| `full`  | All operations            |

> **📖 See the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth)** for Keycloak setup and detailed configuration.

---

## Contributing & Security

[Contributing Guidelines](CONTRIBUTING.md) • [Security Policy](SECURITY.md) • [MIT License](LICENSE) • [Code of Conduct](CODE_OF_CONDUCT.md)

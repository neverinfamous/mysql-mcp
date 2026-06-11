# MySQL MCP Server

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/mysql--mcp-blue?logo=github)](https://github.com/neverinfamous/mysql-mcp)
![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/mysql-mcp)
[![npm](https://img.shields.io/npm/v/@neverinfamous/mysql-mcp)](https://www.npmjs.com/package/@neverinfamous/mysql-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![MCP](https://img.shields.io/badge/MCP-Registry-green.svg)](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/mysql-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/mysql-mcp)
[![E2E](https://github.com/neverinfamous/mysql-mcp/actions/workflows/e2e.yml/badge.svg)](https://github.com/neverinfamous/mysql-mcp/actions/workflows/e2e.yml)
[![Tests](https://img.shields.io/badge/Tests-2185_passed-success.svg)](https://github.com/neverinfamous/mysql-mcp)
[![Coverage](https://img.shields.io/badge/Coverage-85.33%25-green.svg)](https://github.com/neverinfamous/mysql-mcp)

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/mysql-mcp/blob/main/CHANGELOG.md)** • **[Security](https://github.com/neverinfamous/mysql-mcp/blob/main/SECURITY.md)** • **[Release Article](https://adamic.tech/articles/mysql-mcp-server)**

## The Most Comprehensive MySQL MCP Server Available

**mysql-mcp** is the definitive **Model Context Protocol server for MySQL** — empowering AI assistants with **unparalleled database capabilities**. Features **Code Mode** for running tools in a single JavaScript sandbox, eliminating massive token overhead.

### 🎯 Core Features

- **241 Specialized Tools**: From core CRUD and native JSON functions to advanced spatial/GIS, cluster management, introspection, and schema migration.
- **19 Observability Resources**: Real-time schema, performance metrics, and InnoDB diagnostics.
- **Code Mode (Token Savings)**: Execute complex operations locally inside a separate V8 isolate, reducing token overhead by up to 90%.
- **Dual Transport & OAuth 2.1**: Full streamable HTTP and legacy SSE support, protected by granular scopes (`read`, `write`, `admin`, `full`).
- **Deterministic Error Handling**: Every tool returns structured responses with actionable suggestions—no raw exceptions.
- **Smart Tool Filtering**: 25 tool groups + 11 shortcuts let you stay within IDE limits.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 24+
- MySQL 5.7+ or 8.0+ server
- pnpm

### Installation

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

## ⚡ MCP Client Configuration

### HTTP/SSE Server Usage (Advanced)

> **When to use HTTP mode:** Use HTTP mode when deploying `mysql-mcp` as a standalone server that multiple clients can connect to remotely. For local development with Claude Desktop or Cursor IDE, use the default `stdio` mode shown below instead.

**Use cases for HTTP mode:**

- Running the server in a Docker container accessible over a network
- Deploying to cloud platforms (AWS, GCP, Azure)
- Enabling OAuth 2.1 authentication for enterprise security
- Allowing multiple AI clients to share one database connection

### Security Features & Utility Endpoints

For detailed configuration on HTTP mode, CORS, Rate Limiting, and OAuth 2.1 setup (with Keycloak), see the [OAuth Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/OAuth).

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

> **Tip:** For remote connections, ensure your MySQL server allows connections from Docker's IP range and that firewalls/security groups permit port 3306.

---

## 🛠️ Tool Filtering

> [!IMPORTANT]
> **AI IDEs like Cursor have tool limits (typically 40-50 tools).** With 241 tools available, you MUST use tool filtering to stay within your IDE's limits. All shortcuts and tool groups include **Code Mode** (`mysql_execute_code`) by default for token-efficient operations. To exclude it, add `-codemode` to your filter: `--tool-filter core,json,-codemode`

### What Can You Filter?

The `--tool-filter` argument accepts **shortcuts**, **groups**, or **tool names** — mix and match freely:

| Filter Pattern   | Example                          | Tools | Description               |
| ---------------- | -------------------------------- | ----- | ------------------------- |
| Shortcut only    | `starter`                        | 39    | Use a predefined bundle   |
| Groups only      | `core,json,transactions`         | 33    | Combine individual groups |
| Tool names       | `mysql_read_query,mysql_explain` | 2     | Custom tool selection     |
| Shortcut + Group | `starter,spatial`                | 51    | Extend a shortcut         |
| Shortcut - Tool  | `starter,-mysql_drop_table`      | 38    | Remove specific tools     |

#### Custom Tool Selection

You can list individual tool names (without `+` prefix) to create a fully custom whitelist — only the tools you specify will be enabled:

```bash
# Enable exactly 3 tools
--tool-filter "mysql_read_query,mysql_write_query,mysql_list_tables"

# Mix tools from different groups
--tool-filter "mysql_read_query,mysql_explain,mysql_json_extract"
```

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

### Tool Groups (27 Available)

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
| `optimization`  | 4     | Index hints, recommendations                            |
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

---

> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for IDE configuration examples and advanced usage.

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

---

## Contributing & Security

[Contributing Guidelines](CONTRIBUTING.md) • [Security Policy](SECURITY.md) • [MIT License](LICENSE) • [Code of Conduct](CODE_OF_CONDUCT.md)

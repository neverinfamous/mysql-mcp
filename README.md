# mysql-mcp

*Last updated December 13, 2025 - Production/Stable v1.0.0*

*Enterprise-grade MySQL MCP Server with OAuth 2.0 authentication, connection pooling & tool filtering – TypeScript Edition*

> **🎉 Version 1.0.0 Released!** Enterprise-grade MySQL MCP Server with 106 tools, OAuth 2.0, and Docker deployment.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/mysql--mcp-blue?logo=github)](https://github.com/neverinfamous/mysql-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CodeQL](https://github.com/neverinfamous/mysql-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/neverinfamous/mysql-mcp/actions/workflows/codeql.yml)
![Version](https://img.shields.io/badge/version-1.0.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](SECURITY.md)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)

A **MySQL MCP Server** with OAuth 2.0 authentication, connection pooling, and granular access control. Written in TypeScript.

**[Wiki](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)**

---

## 📋 Table of Contents

### Quick Start
- [🚀 Quick Start](#-quick-start)
- [⚡ Install to Cursor IDE](#-install-to-cursor-ide)

### Configuration & Usage
- [📚 MCP Client Configuration](#-mcp-client-configuration)
- [🔌 Connection Pooling](#-connection-pooling)
- [🔀 MySQL Router Configuration](#-mysql-router-configuration)
- [🐙 ProxySQL Configuration](#-proxysql-configuration)
- [🐚 MySQL Shell Configuration](#-mysql-shell-configuration)
- [🎛️ Tool Filtering Presets](#️-tool-filtering-presets)
- [📊 Tool Categories](#-tool-categories)

### Features & Resources
- [🤖 AI-Powered Prompts](#-ai-powered-prompts)
- [🔥 Core Capabilities](#-core-capabilities)
- [🔐 OAuth 2.0 Implementation](#-oauth-20-implementation)
- [🏆 Why Choose mysql-mcp?](#-why-choose-mysql-mcp)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 5.7+ or 8.0+ server
- npm or yarn

### Installation

Clone the repository:
```bash
git clone https://github.com/neverinfamous/mysql-mcp.git
```

Navigate to directory:
```bash
cd mysql-mcp
```

Install dependencies:
```bash
npm install
```

Build the project:
```bash
npm run build
```

Run the server:
```bash
node dist/cli.js --transport stdio --mysql mysql://user:password@localhost:3306/database
```

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## ⚡ Install to Cursor IDE

### Manual Configuration

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database"
      ]
    }
  }
}
```

### Prerequisites
- ✅ Node.js 18+
- ✅ MySQL server running and accessible

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 📚 MCP Client Configuration

### Cursor IDE

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database"
      ]
    }
  }
}
```

### Claude Desktop

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database"
      ]
    }
  }
}
```

### Environment Variables

For security, use environment variables instead of connection strings:

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio"
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

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🔌 Connection Pooling

Unlike SQLite (file-based), MySQL is a server-based database that benefits from connection pooling. This server uses `mysql2` with built-in connection pooling.

### Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `MYSQL_POOL_SIZE` | 10 | Maximum connections in pool |
| `MYSQL_POOL_TIMEOUT` | 10000 | Connection timeout (ms) |

### Example with Pool Settings

```json
{
  "env": {
    "MYSQL_HOST": "localhost",
    "MYSQL_PORT": "3306",
    "MYSQL_USER": "app_user",
    "MYSQL_PASSWORD": "secure_password",
    "MYSQL_DATABASE": "production",
    "MYSQL_POOL_SIZE": "20",
    "MYSQL_POOL_TIMEOUT": "30000"
  }
}
```

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🎛️ Tool Filtering Presets

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 106 tools, you should use tool filtering to stay within limits and optimize for your use case. Choose a preset below.

### Tool Groups

| Group | Tools | Description |
|-------|-------|-------------|
| `core` | 8 | Basic CRUD, schema, tables |
| `json` | 12 | JSON operations (MySQL 5.7+) |
| `text` | 6 | REGEXP, LIKE, SOUNDEX |
| `fulltext` | 4 | FULLTEXT search |
| `performance` | 8 | EXPLAIN, query analysis |
| `optimization` | 4 | Index hints, recommendations |
| `admin` | 6 | OPTIMIZE, ANALYZE, FLUSH |
| `monitoring` | 7 | PROCESSLIST, status variables |
| `backup` | 4 | Export, import, mysqldump |
| `replication` | 5 | Master/slave, binlog |
| `partitioning` | 4 | Partition management |
| `transactions` | 7 | Transaction control |
| `router` | 9 | MySQL Router management |
| `proxysql` | 12 | ProxySQL proxy management |
| `shell` | 10 | MySQL Shell utilities |

### Preset: Minimal (~30 tools) ⭐ Recommended for most users

Core database operations with JSON and text. Best for general development.

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database",
        "--tool-filter", "-performance,-optimization,-backup,-replication,-partitioning,-monitoring,-router,-proxysql,-shell"
      ]
    }
  }
}
```

### Preset: DBA (~37 tools)

Admin, monitoring, performance, and optimization tools. For database administration.

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-json,-text,-fulltext"
  ]
}
```

### Preset: Development (~42 tools)

Core, JSON, text, fulltext, and transactions. For application development.

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-performance,-optimization,-backup,-replication,-partitioning"
  ]
}
```

### Preset: Monitoring (~21 tools)

Monitoring, admin, and replication tools. For operations and observability.

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-core,-json,-text,-fulltext,-optimization,-backup,-partitioning,-transactions"
  ]
}
```

### Custom Filtering

Create your own filter using the syntax:
- `-group` — Disable all tools in a group
- `-tool_name` — Disable a specific tool
- `+tool_name` — Re-enable a tool after group disable

```bash
# Example: Disable replication and partitioning, but keep mysql_master_status
--tool-filter "-replication,-partitioning,+mysql_master_status"
```

[⬆️ Back to Table of Contents](#-table-of-contents)

---


## 📊 Tool Categories

This server provides **106 tools** across 15 categories:

### Core Database (8 tools)

| Tool | Description |
|------|-------------|
| `mysql_read_query` | Execute SELECT with parameter binding |
| `mysql_write_query` | Execute INSERT/UPDATE/DELETE |
| `mysql_list_tables` | List tables with metadata |
| `mysql_describe_table` | Get column definitions |
| `mysql_create_table` | CREATE TABLE with engine/charset |
| `mysql_drop_table` | DROP TABLE with IF EXISTS |
| `mysql_create_index` | CREATE INDEX (BTREE, HASH, FULLTEXT) |
| `mysql_get_indexes` | SHOW INDEX FROM table |

### Transactions (7 tools)

| Tool | Description |
|------|-------------|
| `mysql_transaction_begin` | START TRANSACTION with isolation level |
| `mysql_transaction_commit` | COMMIT |
| `mysql_transaction_rollback` | ROLLBACK |
| `mysql_transaction_savepoint` | SAVEPOINT name |
| `mysql_transaction_release` | RELEASE SAVEPOINT |
| `mysql_transaction_rollback_to` | ROLLBACK TO SAVEPOINT |
| `mysql_transaction_execute` | Execute statements atomically |

### JSON Operations (12 tools)

| Tool | Description |
|------|-------------|
| `mysql_json_extract` | JSON_EXTRACT with path |
| `mysql_json_set` | JSON_SET to modify values |
| `mysql_json_insert` | JSON_INSERT (no overwrite) |
| `mysql_json_replace` | JSON_REPLACE (only existing) |
| `mysql_json_remove` | JSON_REMOVE paths |
| `mysql_json_contains` | JSON_CONTAINS for filtering |
| `mysql_json_keys` | JSON_KEYS to list object keys |
| `mysql_json_array_append` | JSON_ARRAY_APPEND |
| `mysql_json_get` | Simple JSON value extraction |
| `mysql_json_update` | Update JSON field by path |
| `mysql_json_search` | Search JSON for string value |
| `mysql_json_validate` | Validate JSON structure |

### Text Processing (6 tools)

| Tool | Description |
|------|-------------|
| `mysql_regexp_match` | REGEXP pattern matching |
| `mysql_like_search` | LIKE with wildcards |
| `mysql_soundex` | SOUNDEX phonetic matching |
| `mysql_substring` | SUBSTRING extraction |
| `mysql_concat` | String concatenation |
| `mysql_collation_convert` | Character set conversion |

### FULLTEXT Search (4 tools)

| Tool | Description |
|------|-------------|
| `mysql_fulltext_create` | Create FULLTEXT index |
| `mysql_fulltext_search` | MATCH...AGAINST natural language |
| `mysql_fulltext_boolean` | Boolean mode search |
| `mysql_fulltext_expand` | WITH QUERY EXPANSION |

### Performance (8 tools)

| Tool | Description |
|------|-------------|
| `mysql_explain` | EXPLAIN query execution plan |
| `mysql_explain_analyze` | EXPLAIN ANALYZE (MySQL 8.0) |
| `mysql_slow_queries` | Query slow query log |
| `mysql_query_stats` | Performance schema stats |
| `mysql_index_usage` | Index usage statistics |
| `mysql_table_stats` | Table statistics |
| `mysql_buffer_pool_stats` | InnoDB buffer pool info |
| `mysql_thread_stats` | Thread activity stats |

### Optimization (4 tools)

| Tool | Description |
|------|-------------|
| `mysql_index_recommendation` | Suggest missing indexes |
| `mysql_query_rewrite` | Query optimization hints |
| `mysql_force_index` | Generate FORCE INDEX hints |
| `mysql_optimizer_trace` | View optimizer decisions |

### Admin (6 tools)

| Tool | Description |
|------|-------------|
| `mysql_optimize_table` | OPTIMIZE TABLE |
| `mysql_analyze_table` | ANALYZE TABLE statistics |
| `mysql_check_table` | CHECK TABLE integrity |
| `mysql_repair_table` | REPAIR TABLE (MyISAM) |
| `mysql_flush_tables` | FLUSH TABLES |
| `mysql_kill_query` | KILL connection/query |

### Monitoring (7 tools)

| Tool | Description |
|------|-------------|
| `mysql_show_processlist` | SHOW PROCESSLIST |
| `mysql_show_status` | SHOW STATUS variables |
| `mysql_show_variables` | SHOW VARIABLES |
| `mysql_innodb_status` | SHOW ENGINE INNODB STATUS |
| `mysql_replication_status` | SHOW SLAVE STATUS |
| `mysql_pool_stats` | Connection pool statistics |
| `mysql_server_health` | Server health check |

### Backup (4 tools)

| Tool | Description |
|------|-------------|
| `mysql_export_table` | Export table to SQL/CSV |
| `mysql_import_data` | LOAD DATA INFILE |
| `mysql_create_dump` | mysqldump command generation |
| `mysql_restore_dump` | Restore from dump |

### Replication (5 tools)

| Tool | Description |
|------|-------------|
| `mysql_master_status` | SHOW MASTER STATUS |
| `mysql_slave_status` | SHOW SLAVE STATUS |
| `mysql_binlog_events` | SHOW BINLOG EVENTS |
| `mysql_gtid_status` | GTID_EXECUTED status |
| `mysql_replication_lag` | Calculate replication lag |

### Partitioning (4 tools)

| Tool | Description |
|------|-------------|
| `mysql_partition_info` | Partition information |
| `mysql_add_partition` | ADD PARTITION |
| `mysql_drop_partition` | DROP PARTITION |
| `mysql_reorganize_partition` | REORGANIZE PARTITION |

### MySQL Router (9 tools)

> [!NOTE]
> Router tools require MySQL Router 8.0.17+ with REST API enabled. Tools marked with ⚠️ require InnoDB Cluster.

| Tool | Description |
|------|-------------|
| `mysql_router_status` | Get Router process status and version |
| `mysql_router_routes` | List all configured routes |
| `mysql_router_route_status` | Get status of a specific route |
| `mysql_router_route_health` | Check health/liveness of a route |
| `mysql_router_route_connections` | List active connections on route |
| `mysql_router_route_destinations` | List backend MySQL server destinations |
| `mysql_router_route_blocked_hosts` | List blocked IP addresses for a route |
| `mysql_router_metadata_status` | ⚠️ InnoDB Cluster metadata cache status |
| `mysql_router_pool_status` | ⚠️ Connection pool statistics |

### ProxySQL (12 tools)

> [!NOTE]
> ProxySQL tools require access to ProxySQL admin interface (default port 6032).

| Tool | Description |
|------|-------------|
| `proxysql_status` | Get ProxySQL version, uptime, and runtime stats |
| `proxysql_servers` | List configured backend MySQL servers |
| `proxysql_hostgroups` | List hostgroup configurations and connection stats |
| `proxysql_query_rules` | List query routing rules |
| `proxysql_query_digest` | Get query digest statistics (top queries) |
| `proxysql_connection_pool` | Get connection pool statistics per server |
| `proxysql_users` | List configured MySQL users |
| `proxysql_global_variables` | Get global variables (mysql-* and admin-*) |
| `proxysql_runtime_status` | Get runtime configuration status |
| `proxysql_memory_stats` | Get memory usage metrics |
| `proxysql_commands` | Execute LOAD/SAVE admin commands |
| `proxysql_process_list` | Get active sessions like SHOW PROCESSLIST |

[⬆️ Back to Table of Contents](#-table-of-contents)

---

### MySQL Shell (10 tools)

> [!NOTE]
> Shell tools require MySQL Shell 8.0+ to be installed. Set `MYSQLSH_PATH` if not in system PATH.
> **Version Compatibility**: MySQL Shell version should match your MySQL Server version for dump/load operations.

| Tool | Description |
|------|-------------|
| `mysqlsh_version` | Get MySQL Shell version and installation status |
| `mysqlsh_check_upgrade` | Check server upgrade compatibility |
| `mysqlsh_export_table` | Export table to file (CSV, TSV, JSON) |
| `mysqlsh_import_table` | Parallel table import from file |
| `mysqlsh_import_json` | Import JSON documents to collection or table |
| `mysqlsh_dump_instance` | Dump entire MySQL instance |
| `mysqlsh_dump_schemas` | Dump selected schemas |
| `mysqlsh_dump_tables` | Dump specific tables |
| `mysqlsh_load_dump` | Load MySQL Shell dump |
| `mysqlsh_run_script` | Execute JS/Python/SQL script via MySQL Shell |

---

## 🤖 AI-Powered Prompts

This server includes **4 intelligent prompts** that guide you through complex MySQL workflows:

| Prompt | Description |
|--------|-------------|
| `mysql_query_builder` | Construct SQL queries with proper escaping, security, and indexing recommendations |
| `mysql_schema_design` | Design table schemas with data types, indexes, foreign keys, and best practices |
| `mysql_performance_analysis` | Analyze slow queries and get EXPLAIN-based optimization recommendations |
| `mysql_migration` | Generate migration scripts with UP/DOWN, safety checks, and online migration options |

### Prompt Arguments

#### mysql_query_builder
| Argument | Required | Description |
|----------|----------|-------------|
| `operation` | ✅ | Query type: SELECT, INSERT, UPDATE, or DELETE |
| `table` | ✅ | Target table name |
| `description` | ✅ | What you want to accomplish |

#### mysql_schema_design
| Argument | Required | Description |
|----------|----------|-------------|
| `entity` | ✅ | What entity/data to store (e.g., "e-commerce product catalog") |
| `requirements` | ❌ | Specific requirements (e.g., "track price history, support multiple images") |

#### mysql_performance_analysis
| Argument | Required | Description |
|----------|----------|-------------|
| `query` | ✅ | The slow SQL query to analyze |
| `context` | ❌ | Table structure and data volume context |

#### mysql_migration
| Argument | Required | Description |
|----------|----------|-------------|
| `change` | ✅ | Schema change description (e.g., "Add email column VARCHAR(255)") |
| `table` | ✅ | Target table name |

### Example Usage

```
/mysql-mcp/mysql_migration
  change: "Add an email column (VARCHAR(255), UNIQUE, NOT NULL)"
  table: "users"
```

The prompt will generate complete UP/DOWN migrations, safety considerations, lock time estimates, and online migration options (pt-online-schema-change, gh-ost).

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🔥 Core Capabilities

- 📊 **Full SQL Support** - Execute any MySQL query with parameter binding
- 🔍 **JSON Operations** - Native JSON functions (MySQL 5.7+)
- 🔐 **Connection Pooling** - Efficient connection management
- 🎛️ **Tool Filtering** - Control which operations are exposed
- ⚡ **Performance Tools** - EXPLAIN, query analysis, optimization hints

### 🏢 Enterprise Features

- 🔐 **OAuth 2.0 Authentication** - RFC 9728/8414 compliant
- 🛡️ **Tool Filtering** - Control which database operations are exposed
- 👥 **Access Control** - Granular scopes for read-only, write, and admin access
- 📈 **Monitoring** - Process lists, status variables, performance metrics

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🔐 OAuth 2.0 Implementation

| Component | Status | Description |
|-----------|--------|-------------|
| Protected Resource Metadata | 🔄 | RFC 9728 `/.well-known/oauth-protected-resource` |
| Auth Server Discovery | 🔄 | RFC 8414 metadata discovery |
| Token Validation | 🔄 | JWT validation with JWKS support |
| Scope Enforcement | 🔄 | Granular `read`, `write`, `admin` scopes |
| HTTP Transport | 🔄 | Streamable HTTP with OAuth middleware |

### Supported Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read-only access to all databases |
| `write` | Read and write access to all databases |
| `admin` | Full administrative access |
| `db:{name}` | Access to specific database only |
| `table:{db}:{table}` | Access to specific table only |

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🏆 Why Choose mysql-mcp?

✅ **TypeScript Native** - Full type safety with strict mode  
✅ **Connection Pooling** - Efficient MySQL connection management  
✅ **OAuth 2.0 Built-in** - Enterprise-grade authentication  
✅ **Tool Filtering** - Stay within AI IDE tool limits  
✅ **Modern Architecture** - Built on MCP SDK  
✅ **Active Development** - Regular updates and improvements

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_password_here
MYSQL_DATABASE=your_database
MYSQL_POOL_SIZE=10
```

---

## 🔀 MySQL Router Configuration

If using MySQL Router tools for InnoDB Cluster management, you need to configure access to the Router's REST API.

### Prerequisites

- MySQL Router 8.0.17+ with REST API enabled
- Router REST API credentials (username/password)
- Network access to Router REST API endpoint (default: HTTPS on port 8443)

### Setting Up Router API Authentication

MySQL Router REST API requires authentication. Follow these steps to configure it:

#### 1. Enable REST API in MySQL Router

Ensure your `mysqlrouter.conf` includes the REST API plugins:

```ini
[http_server]
port=8443
ssl=1
ssl_cert=/path/to/router-cert.pem
ssl_key=/path/to/router-key.pem

[http_auth_realm:default_auth_realm]
backend=default_auth_backend
method=basic
name=default_realm

[http_auth_backend:default_auth_backend]
backend=file
filename=/path/to/mysqlrouter.pwd

[rest_router]
require_realm=default_auth_realm

[rest_routing]
require_realm=default_auth_realm

[rest_metadata_cache]
require_realm=default_auth_realm

[rest_connection_pool]
require_realm=default_auth_realm
```

#### 2. Create Router API Credentials

Create a password file for the REST API:

```bash
# Generate password hash (prompts for password)
mysqlrouter_passwd set /path/to/mysqlrouter.pwd router_admin
```

#### 3. Configure Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQL_ROUTER_URL` | `https://localhost:8443` | Router REST API base URL |
| `MYSQL_ROUTER_USER` | - | Router API username |
| `MYSQL_ROUTER_PASSWORD` | - | Router API password |
| `MYSQL_ROUTER_API_VERSION` | `/api/20190715` | API version path |
| `MYSQL_ROUTER_INSECURE` | `false` | Skip TLS verification (for self-signed certs) |

> [!CAUTION]
> **Never commit Router credentials to version control.** Use environment variables or secure secrets management.

### MCP Client Configuration with Router

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "app_user",
        "MYSQL_PASSWORD": "secure_password",
        "MYSQL_DATABASE": "production",
        "MYSQL_ROUTER_URL": "https://router.example.com:8443",
        "MYSQL_ROUTER_USER": "router_admin",
        "MYSQL_ROUTER_PASSWORD": "router_password",
        "MYSQL_ROUTER_INSECURE": "true"
      }
    }
  }
}
```

### Router-Only Configuration

If you only want Router tools (e.g., for a dedicated monitoring agent):

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-core,-json,-text,-fulltext,-performance,-optimization,-admin,-monitoring,-backup,-replication,-partitioning,-transactions"
  ]
}
```

This exposes only the 9 Router management tools.

### ProxySQL-Only Configuration

If you only want ProxySQL tools:

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-core,-json,-text,-fulltext,-performance,-optimization,-admin,-monitoring,-backup,-replication,-partitioning,-transactions,-router"
  ]
}
```

This exposes only the 12 ProxySQL management tools.

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🐙 ProxySQL Configuration

If using ProxySQL tools for proxy management, you need to configure access to the ProxySQL admin interface.

### Prerequisites

- ProxySQL 2.x+ with admin interface enabled
- Admin interface credentials (default: admin/admin on port 6032)
- Network access to ProxySQL admin port

### Setting Up ProxySQL Admin Access

#### 1. Default Admin Interface

ProxySQL's admin interface is enabled by default on port 6032. Connect using:

```bash
mysql -h127.0.0.1 -P6032 -uadmin -padmin
```

#### 2. Configure Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROXYSQL_HOST` | `localhost` | ProxySQL admin interface host |
| `PROXYSQL_PORT` | `6032` | ProxySQL admin port |
| `PROXYSQL_USER` | `admin` | Admin username |
| `PROXYSQL_PASSWORD` | `admin` | Admin password |

> [!CAUTION]
> **Change default ProxySQL admin credentials in production.** Use environment variables or secure secrets management.

### MCP Client Configuration with ProxySQL

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "app_user",
        "MYSQL_PASSWORD": "secure_password",
        "MYSQL_DATABASE": "production",
        "PROXYSQL_HOST": "localhost",
        "PROXYSQL_PORT": "6032",
        "PROXYSQL_USER": "admin",
        "PROXYSQL_PASSWORD": "admin"
      }
    }
  }
}
```

[⬆️ Back to Table of Contents](#-table-of-contents)

---

## 🐚 MySQL Shell Configuration

If using MySQL Shell tools for advanced data operations, you need MySQL Shell 8.0+ installed.

### Prerequisites

- MySQL Shell 8.0+ installed
- MySQL Shell binary accessible (in PATH or via environment variable)
- **Version Compatibility**: MySQL Shell version should match or be newer than your MySQL Server version

> [!WARNING]
> **Version Mismatch**: MySQL Shell 8.0.x has limited compatibility with MySQL Server 9.x. For best results, ensure your MySQL Shell version matches your server version. The dump/load utilities may show warnings or errors when versions don't align.

### Tool-Specific Requirements

| Tool | Requirements |
|------|--------------|
| `mysqlsh_import_json` | Requires X Protocol (port 33060) for collection imports |
| `mysqlsh_load_dump` | Requires `local_infile=ON` in MySQL Server config |
| `mysqlsh_check_upgrade` | User needs RELOAD, PROCESS, SELECT privileges |
| `mysqlsh_dump_*` / `mysqlsh_load_dump` | Shell version should match server version |

### Setting Up MySQL Shell

#### 1. Verify Installation

```bash
mysqlsh --version
# Expected: mysqlsh   Ver 8.0.x for ...
```

#### 2. Configure Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MYSQLSH_PATH` | `mysqlsh` | Path to MySQL Shell binary |
| `MYSQLSH_WORK_DIR` | Current directory | Working directory for dump/load operations |
| `MYSQLSH_TIMEOUT` | `300000` | Command timeout in milliseconds (5 min) |

> [!CAUTION]
> **MySQL Shell commands execute as subprocesses.** Ensure proper file system permissions for dump/load operations.

### MCP Client Configuration with MySQL Shell

```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/mysql-mcp/dist/cli.js",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@localhost:3306/database"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "your_password",
        "MYSQL_DATABASE": "production",
        "MYSQLSH_PATH": "mysqlsh"
      }
    }
  }
}
```

### Shell-Only Configuration

If you only want MySQL Shell tools (e.g., for a dedicated backup/migration agent):

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-core,-json,-text,-fulltext,-performance,-optimization,-admin,-monitoring,-backup,-replication,-partitioning,-transactions,-router,-proxysql"
  ]
}
```

This exposes only the 10 MySQL Shell management tools.

[⬆️ Back to Table of Contents](#-table-of-contents)

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

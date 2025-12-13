# MySQL MCP Server

Last Updated December 13, 2025 - Production/Stable v1.0.0

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/mysql--mcp-blue?logo=github)](https://github.com/neverinfamous/mysql-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/mysql-mcp)](https://hub.docker.com/r/writenotenow/mysql-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-v1.0.0-green)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/mysql-mcp/blob/master/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/mysql-mcp)

Enterprise-grade MySQL MCP Server with **106 specialized tools** for database operations, JSON, text search, performance analysis, replication, and administration.

**[Wiki](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](https://github.com/neverinfamous/mysql-mcp/blob/master/CHANGELOG.md)** • **[Release Notes](https://github.com/neverinfamous/mysql-mcp/releases)**

## 🚀 Quick Start

```bash
docker run -i --rm writenotenow/mysql-mcp:latest \
  --transport stdio \
  --mysql mysql://user:password@host:3306/database
```

**MCP Config (Claude Desktop / Cursor):**
```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "writenotenow/mysql-mcp:latest",
        "--transport", "stdio",
        "--mysql", "mysql://user:password@host.docker.internal:3306/database"
      ]
    }
  }
}
```

> **Note:** Use `host.docker.internal` to connect to MySQL running on your host machine.

## 🎛️ Tool Filtering

Reduce tool count for clients with limits (Cursor: ~80 warning):

```bash
docker run -i --rm \
  writenotenow/mysql-mcp:latest \
  --transport stdio \
  --mysql mysql://user:password@host:3306/database \
  --tool-filter "-performance,-optimization,-backup,-replication,-partitioning,-router,-proxysql,-shell"
```

| Syntax | Description |
|--------|-------------|
| `-group` | Disable all tools in group |
| `-tool` | Disable specific tool |
| `+tool` | Re-enable after group disable |

**Groups:** core(8), json(12), text(6), fulltext(4), performance(8), optimization(4), admin(6), monitoring(7), backup(4), replication(5), partitioning(4), transactions(7), router(9), proxysql(12), shell(10)

**Common filters:**
- Minimal (~30): `-performance,-optimization,-backup,-replication,-partitioning,-monitoring,-router,-proxysql,-shell`
- DBA (~37): `-json,-text,-fulltext`
- Development (~42): `-performance,-optimization,-backup,-replication,-partitioning`

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `MYSQL_HOST` | MySQL server hostname |
| `MYSQL_PORT` | MySQL server port (default: 3306) |
| `MYSQL_USER` | MySQL username |
| `MYSQL_PASSWORD` | MySQL password |
| `MYSQL_DATABASE` | Default database |
| `MYSQL_POOL_SIZE` | Connection pool size (default: 10) |

**With environment variables:**
```json
{
  "mcpServers": {
    "mysql-mcp": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "writenotenow/mysql-mcp:latest", "--transport", "stdio"],
      "env": {
        "MYSQL_HOST": "host.docker.internal",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "password",
        "MYSQL_DATABASE": "mydb"
      }
    }
  }
}
```

## 📊 Tool Categories (106 tools)

| Category | Tools | Description |
|----------|-------|-------------|
| Core | 8 | CRUD, schema, tables, indexes |
| Transactions | 7 | BEGIN, COMMIT, ROLLBACK, savepoints |
| JSON | 12 | JSON_EXTRACT, JSON_SET, JSON_CONTAINS |
| Text | 6 | REGEXP, LIKE, SOUNDEX |
| FULLTEXT | 4 | Natural language and boolean search |
| Performance | 8 | EXPLAIN, query analysis |
| Optimization | 4 | Index hints, recommendations |
| Admin | 6 | OPTIMIZE, ANALYZE, CHECK |
| Monitoring | 7 | PROCESSLIST, status variables |
| Backup | 4 | Export, import, mysqldump |
| Replication | 5 | Master/slave, binlog, GTID |
| Partitioning | 4 | Partition management |
| Router | 9 | MySQL Router REST API |
| ProxySQL | 12 | Proxy management |
| Shell | 10 | MySQL Shell utilities |

## 🤖 AI-Powered Prompts

| Prompt | Description |
|--------|-------------|
| `mysql_query_builder` | Construct SQL queries with security best practices |
| `mysql_schema_design` | Design table schemas with indexes and relationships |
| `mysql_performance_analysis` | Analyze slow queries with optimization recommendations |
| `mysql_migration` | Generate migration scripts with rollback options |

## 📦 Container Info

| Property | Value |
|----------|-------|
| Base Image | `node:20-alpine` |
| Size | ~150MB |
| Architectures | `linux/amd64`, `linux/arm64` |
| User | Non-root |

## 🏷️ Available Tags

| Tag | Description |
|-----|-------------|
| `latest` | Current stable (v1.0.0) |
| `v1.0.0` | First production release |
| `sha-XXXXXX` | Commit-pinned builds |

## 🔍 Resources

- [GitHub Repository](https://github.com/neverinfamous/mysql-mcp)
- [Wiki Documentation](https://github.com/neverinfamous/mysql-mcp/wiki)
- [Changelog](https://github.com/neverinfamous/mysql-mcp/blob/master/CHANGELOG.md)
- [Full README](https://github.com/neverinfamous/mysql-mcp/blob/master/README.md)

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Use `host.docker.internal` for host MySQL |
| Authentication failed | Verify MySQL credentials |
| Too many tools warning | Use `--tool-filter` to reduce tools |
| Permission denied | Check MySQL user permissions |

**Architectures:** linux/amd64, linux/arm64

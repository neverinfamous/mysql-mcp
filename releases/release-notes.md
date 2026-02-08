# mysql-mcp v1.0.0 Release Notes

**Release Date:** December 13, 2025  
**Status:** Production/Stable

Enterprise-grade MySQL MCP Server with OAuth 2.0 authentication, connection pooling, and granular tool filtering. Written in TypeScript.

---

## 🎉 Highlights

- **106 MySQL Tools** across 15 categories
- **4 AI-Powered Prompts** for guided MySQL workflows
- **Docker Support** with multi-architecture images (amd64/arm64)
- **OAuth 2.0 Authentication** for enterprise deployments
- **Tool Filtering** to stay within AI IDE limits

---

## ✨ Features

### Tool Categories (106 tools)

| Category        | Tools | Description                            |
| --------------- | ----- | -------------------------------------- |
| Core Database   | 8     | CRUD, schema, tables, indexes          |
| Transactions    | 7     | BEGIN, COMMIT, ROLLBACK, savepoints    |
| JSON Operations | 12    | JSON_EXTRACT, JSON_SET, JSON_CONTAINS  |
| Text Processing | 6     | REGEXP, LIKE, SOUNDEX, SUBSTRING       |
| FULLTEXT Search | 4     | Natural language and boolean search    |
| Performance     | 8     | EXPLAIN, query analysis, buffer pool   |
| Optimization    | 4     | Index hints, query rewrite suggestions |
| Admin           | 6     | OPTIMIZE, ANALYZE, CHECK, REPAIR       |
| Monitoring      | 7     | PROCESSLIST, status variables, health  |
| Backup          | 4     | Export, import, mysqldump              |
| Replication     | 5     | Master/slave status, binlog, GTID      |
| Partitioning    | 4     | Partition management                   |
| MySQL Router    | 9     | Router REST API management             |
| ProxySQL        | 12    | Proxy monitoring and configuration     |
| MySQL Shell     | 10    | Shell utilities, dump/load, upgrades   |

### AI-Powered Prompts

| Prompt                       | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `mysql_query_builder`        | Construct SQL queries with security best practices     |
| `mysql_schema_design`        | Design table schemas with indexes and relationships    |
| `mysql_performance_analysis` | Analyze slow queries with optimization recommendations |
| `mysql_migration`            | Generate migration scripts with rollback options       |

### Enterprise Features

- **OAuth 2.0** - RFC 9728/8414 compliant authentication
- **Tool Filtering** - Granular control over exposed operations
- **Connection Pooling** - Configurable mysql2 pool
- **Multiple Transports** - stdio, HTTP, SSE

---

## 🐳 Docker Deployment

```bash
docker pull writenotenow/mysql-mcp:v1.0.0
```

```bash
docker run -i --rm writenotenow/mysql-mcp:v1.0.0 \
  --transport stdio \
  --mysql mysql://user:password@host:3306/database
```

**Architectures:** linux/amd64, linux/arm64

---

## 🔧 MCP Client Configuration

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
        "writenotenow/mysql-mcp:v1.0.0",
        "--transport",
        "stdio",
        "--mysql",
        "mysql://user:password@host:3306/database"
      ]
    }
  }
}
```

---

## 🎛️ Tool Filtering

Reduce tool count for clients with limits:

```json
{
  "args": [
    "--tool-filter",
    "-performance,-optimization,-backup,-replication,-partitioning,-router,-proxysql,-shell"
  ]
}
```

**Presets:**

- Minimal (~30 tools): Core + JSON + Text
- DBA (~37 tools): Admin + Monitoring + Performance
- Development (~42 tools): Core + JSON + Text + Transactions

---

## 📚 Documentation

- **[GitHub Repository](https://github.com/neverinfamous/mysql-mcp)**
- **[Wiki](https://github.com/neverinfamous/mysql-mcp/wiki)**
- **[Docker Hub](https://hub.docker.com/r/writenotenow/mysql-mcp)**

---

## 🛡️ Security

- SQL injection prevention via parameterized queries
- OAuth 2.0 scope-based access control
- Environment variable configuration for sensitive data
- Non-root Docker container execution

---

**Full Changelog:** https://github.com/neverinfamous/mysql-mcp/blob/master/CHANGELOG.md

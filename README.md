# mysql-mcp

<!-- mcp-name: io.github.neverinfamous/mysql-mcp -->

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

A **MySQL MCP Server** that enables AI assistants (Claude, Cursor, etc.) to interact with MySQL databases through the Model Context Protocol. Provides **106 specialized tools** and **4 AI-powered prompts**.

**[📚 Full Documentation (Wiki)](https://github.com/neverinfamous/mysql-mcp/wiki)** • **[Changelog](CHANGELOG.md)** • **[Security](SECURITY.md)**

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- MySQL 5.7+ or 8.0+ server
- npm or yarn

### Installation

```bash
git clone https://github.com/neverinfamous/mysql-mcp.git
cd mysql-mcp
npm install
npm run build
node dist/cli.js --transport stdio --mysql mysql://user:password@localhost:3306/database
```

### Docker

```bash
docker run -i --rm writenotenow/mysql-mcp:latest \
  --transport stdio \
  --mysql mysql://user:password@host.docker.internal:3306/database
```

---

## ⚡ MCP Client Configuration

### Cursor IDE / Claude Desktop

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

### Using Environment Variables (Recommended)

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

> **📖 See the [Configuration Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Configuration)** for more configuration options.

---

## 🔗 Database Connection Scenarios

| Scenario | Host to Use | Example Connection String |
|----------|-------------|---------------------------|
| **MySQL on host machine** | `host.docker.internal` | `mysql://user:pass@host.docker.internal:3306/db` |
| **MySQL in Docker** | Container name or network | `mysql://user:pass@mysql-container:3306/db` |
| **Remote/Cloud MySQL** | Hostname or IP | `mysql://user:pass@db.example.com:3306/db` |

### MySQL on Host Machine
If MySQL is installed directly on your computer (via installer, Homebrew, etc.):
```json
"--mysql", "mysql://user:password@host.docker.internal:3306/database"
```

### MySQL in Another Docker Container
Add both containers to the same Docker network, then use the container name:
```bash
# Create network and run MySQL
docker network create mynet
docker run -d --name mysql-db --network mynet -e MYSQL_ROOT_PASSWORD=pass mysql:8
# Run MCP server on same network
docker run -i --rm --network mynet writenotenow/mysql-mcp:latest \
  --transport stdio --mysql mysql://root:pass@mysql-db:3306/mysql
```

### Remote/Cloud MySQL (RDS, Cloud SQL, etc.)
Use the remote hostname directly:
```json
"--mysql", "mysql://user:password@your-instance.region.rds.amazonaws.com:3306/database"
```

| Provider | Example Hostname |
|----------|------------------|
| AWS RDS | `your-instance.xxxx.us-east-1.rds.amazonaws.com` |
| Google Cloud SQL | `project:region:instance` (via Cloud SQL Proxy) |
| Azure MySQL | `your-server.mysql.database.azure.com` |
| PlanetScale | `aws.connect.psdb.cloud` (SSL required) |
| DigitalOcean | `your-cluster-do-user-xxx.db.ondigitalocean.com` |

> **Tip:** For remote connections, ensure your MySQL server allows connections from Docker's IP range and that firewalls/security groups permit port 3306.

---

## 🛠️ Tool Categories

This server provides **106 tools** across 15 categories:

| Category | Tools | Description |
|----------|-------|-------------|
| Core | 8 | CRUD, schema, tables, indexes |
| Transactions | 7 | BEGIN, COMMIT, ROLLBACK, savepoints |
| JSON | 12 | JSON_EXTRACT, JSON_SET, etc. (MySQL 5.7+) |
| Text | 6 | REGEXP, LIKE, SOUNDEX |
| FULLTEXT | 4 | Natural language search |
| Performance | 8 | EXPLAIN, query analysis |
| Optimization | 4 | Index hints, recommendations |
| Admin | 6 | OPTIMIZE, ANALYZE, CHECK |
| Monitoring | 7 | PROCESSLIST, status variables |
| Backup | 4 | Export, import, mysqldump |
| Replication | 5 | Master/slave, binlog |
| Partitioning | 4 | Partition management |
| Router | 9 | MySQL Router REST API |
| ProxySQL | 12 | Proxy management |
| Shell | 10 | MySQL Shell utilities |

> **📖 See the [Tool Reference Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Reference)** for the complete list of all 106 tools.

---

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs like Cursor have tool limits.** With 106 tools, you should use tool filtering to stay within limits.

**Example: Minimal preset (~30 tools)**

```json
{
  "args": [
    "--transport", "stdio",
    "--mysql", "mysql://user:password@localhost:3306/database",
    "--tool-filter", "-performance,-optimization,-backup,-replication,-partitioning,-monitoring,-router,-proxysql,-shell"
  ]
}
```

> **📖 See the [Tool Filtering Wiki](https://github.com/neverinfamous/mysql-mcp/wiki/Tool-Filtering)** for DBA, Development, Monitoring, and component-specific presets.

---

## 🤖 AI-Powered Prompts

This server includes **4 intelligent prompts** for guided workflows:

| Prompt | Description |
|--------|-------------|
| `mysql_query_builder` | Construct SQL queries with security best practices |
| `mysql_schema_design` | Design table schemas with indexes and relationships |
| `mysql_performance_analysis` | Analyze slow queries with optimization recommendations |
| `mysql_migration` | Generate migration scripts with rollback options |

---

## 🔧 Advanced Configuration

For specialized setups, see these Wiki pages:

| Topic | Description |
|-------|-------------|
| [MySQL Router](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Router) | Configure Router REST API access for InnoDB Cluster |
| [ProxySQL](https://github.com/neverinfamous/mysql-mcp/wiki/ProxySQL) | Configure ProxySQL admin interface access |
| [MySQL Shell](https://github.com/neverinfamous/mysql-mcp/wiki/MySQL-Shell) | Configure MySQL Shell for dump/load operations |

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

---

## 🏆 Why Choose mysql-mcp?

✅ **TypeScript Native** - Full type safety with strict mode  
✅ **Connection Pooling** - Efficient MySQL connection management  
✅ **OAuth 2.0 Built-in** - Enterprise-grade authentication  
✅ **Tool Filtering** - Stay within AI IDE tool limits  
✅ **Modern Architecture** - Built on MCP SDK  
✅ **Active Development** - Regular updates and improvements

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

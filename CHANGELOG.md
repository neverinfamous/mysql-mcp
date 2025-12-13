# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **MySQL Router Support** - 9 new tools for monitoring MySQL Router via REST API
  - `mysql_router_status` - Get Router process status and version
  - `mysql_router_routes` - List all configured routes
  - `mysql_router_route_status` - Get status of a specific route
  - `mysql_router_route_health` - Check health/liveness of a route
  - `mysql_router_route_connections` - List active connections on route
  - `mysql_router_route_destinations` - List backend MySQL server destinations
  - `mysql_router_route_blocked_hosts` - List blocked IP addresses for a route
  - `mysql_router_metadata_status` - InnoDB Cluster metadata cache status *(requires InnoDB Cluster)*
  - `mysql_router_pool_status` - Connection pool statistics *(requires InnoDB Cluster)*
- New `router` tool group for filtering Router tools
- Router REST API configuration via environment variables
- Comprehensive Router setup documentation in README
- **ProxySQL Support** - 12 new tools for monitoring ProxySQL proxy
  - `proxysql_status` - Get ProxySQL version, uptime, and runtime stats
  - `proxysql_servers` - List configured backend MySQL servers
  - `proxysql_hostgroups` - List hostgroup configurations and connection stats
  - `proxysql_query_rules` - List query routing rules
  - `proxysql_query_digest` - Get query digest statistics (top queries)
  - `proxysql_connection_pool` - Get connection pool statistics per server
  - `proxysql_users` - List configured MySQL users
  - `proxysql_global_variables` - Get global variables (mysql-* and admin-*)
  - `proxysql_runtime_status` - Get runtime configuration status
  - `proxysql_memory_stats` - Get memory usage metrics
  - `proxysql_commands` - Execute LOAD/SAVE admin commands
  - `proxysql_process_list` - Get active sessions like SHOW PROCESSLIST
- New `proxysql` tool group for filtering ProxySQL tools
- ProxySQL admin interface configuration via environment variables
- Comprehensive ProxySQL setup documentation in README
- **MySQL Shell Support** - 10 new tools for MySQL Shell 8.0 integration
  - `mysqlsh_version` - Get MySQL Shell version and installation status
  - `mysqlsh_check_upgrade` - Check server upgrade compatibility
  - `mysqlsh_export_table` - Export table to file (CSV, TSV, JSON)
  - `mysqlsh_import_table` - Parallel table import from file
  - `mysqlsh_import_json` - Import JSON documents to collection or table
  - `mysqlsh_dump_instance` - Dump entire MySQL instance
  - `mysqlsh_dump_schemas` - Dump selected schemas
  - `mysqlsh_dump_tables` - Dump specific tables
  - `mysqlsh_load_dump` - Load MySQL Shell dump
  - `mysqlsh_run_script` - Execute JS/Python/SQL script via MySQL Shell
- New `shell` tool group for filtering MySQL Shell tools
- MySQL Shell configuration via environment variables (MYSQLSH_PATH, MYSQLSH_TIMEOUT, MYSQLSH_WORK_DIR)
- Comprehensive MySQL Shell setup documentation in README

### Changed
- Total tools increased from 75 to 106
- Tool groups increased from 12 to 15
- Updated `.env.example` with Router and ProxySQL configuration templates
- Updated minimal preset to exclude Router, ProxySQL, and Shell tools by default

### Fixed
- **Prompt Parameter Passing** - Fixed issue where prompt arguments showed `undefined` instead of actual values. Prompts now properly pass arguments from MCP clients to handlers.

## [0.1.0] - 2025-12-13

### Added
- **84 MySQL tools** across 13 categories
- **4 AI-Powered Prompts** for guided MySQL workflows:
  - `mysql_query_builder` - Help construct SQL queries with security best practices
  - `mysql_schema_design` - Design table schemas with indexes and relationships
  - `mysql_performance_analysis` - Analyze slow queries with optimization recommendations
  - `mysql_migration` - Generate migration scripts with rollback and online migration options
- Core database operations (CRUD, schema, tables)
- JSON operations (MySQL 5.7+)
- Text processing (REGEXP, LIKE, SOUNDEX)
- FULLTEXT search support
- Performance tools (EXPLAIN, query analysis)
- Optimization tools (index hints, recommendations)
- Admin tools (OPTIMIZE, ANALYZE, FLUSH)
- Monitoring tools (PROCESSLIST, status variables)
- Backup tools (export, import, mysqldump format)
- Replication tools (master/slave, binlog, GTID)
- Partitioning tools (partition management)
- Transaction tools (BEGIN, COMMIT, ROLLBACK, savepoints)
- MySQL Router tools (status, routes, health monitoring)
- **Tool Filtering System** - Filter by group or individual tools
- **OAuth 2.0 Support** - Keycloak integration for enterprise auth
- **Connection Pooling** - Configurable mysql2 pool
- **Multiple Transports** - stdio, HTTP, SSE
- MCP SDK integration
- Comprehensive documentation and examples

### Security
- SQL injection prevention via parameterized queries
- OAuth 2.0 scope-based access control
- Environment variable configuration for sensitive data

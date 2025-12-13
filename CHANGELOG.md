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

### Changed
- Total tools increased from 75 to 84
- Tool groups increased from 12 to 13
- Updated `.env.example` with Router configuration template
- Updated minimal preset to exclude Router tools by default

## [0.1.0] - 2025-12-13

### Added
- **84 MySQL tools** across 13 categories
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

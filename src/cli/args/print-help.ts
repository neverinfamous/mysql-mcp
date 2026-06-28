

/**
 * Print help message
 */
export function printHelp(): void {
  console.error(`
mysql-mcp - Enterprise MySQL MCP Server

Usage: mysql-mcp [options]

Connection Options:
  --mysql, -m <url>           MySQL connection string
                              (mysql://user:pass@host:port/database)
  --mysql-host <host>         MySQL host (default: localhost)
  --mysql-port <port>         MySQL port (default: 3306)
  --mysql-user <user>         MySQL username
  --mysql-password <pass>     MySQL password
  --mysql-database <db>       MySQL database name

Pool Options:
  --pool-size <n>             Connection pool size (default: 10)
  --pool-timeout <ms>         Connection acquire timeout (default: 30000)
  --pool-queue-limit <n>      Queue limit for waiting requests (default: 0)

Server Options:
  --config, -c <path>         Load configuration from YAML/JSON file
  --dump-config               Print the resolved configuration and exit
  --transport, -t <type>      Transport type: stdio, http, sse (default: stdio)
  --port, -p <port>           HTTP port for http/sse transports
  --server-host <host>        Host to bind HTTP transport to (default: localhost)
  --tool-filter, -f <filter>  Tool filter string (e.g., "-replication,-partitioning")
  --name <name>               Server name (default: mysql-mcp)

OAuth Options:
  --oauth-enabled, -o         Enable OAuth 2.1 authentication
  --oauth-issuer <url>        Authorization server URL (issuer)
  --oauth-audience <aud>      Expected token audience
  --oauth-jwks-uri <url>      JWKS URI (auto-discovered from issuer if not set)
  --oauth-clock-tolerance <s> Clock tolerance in seconds (default: 60)

Authentication & Security:
  --auth-token <token>        Simple bearer token for HTTP authentication (env: MCP_AUTH_TOKEN)
  --stateless                 Enable stateless HTTP mode (no sessions, no SSE)
  --enable-hsts               Enable HSTS header (use when behind HTTPS)
  --trust-proxy               Trust X-Forwarded-For header for client IP
  --log-level <level>         Log level: debug, info, warn, error (default: info)
  --metrics-export [format]   Enable metrics export endpoint (prometheus)

Audit Options:
  --audit-log <path>          Path to JSONL audit log file (or 'stderr' to stream)
  --audit-redact              Redact tool arguments from audit log
  --audit-reads               Log read operations in addition to writes/admins
  --audit-log-max-size <b>    Max audit log size in bytes before rotation (default: 10MB)
  --audit-backup              Enable pre-mutation DDL snapshots for destructive tools
  --audit-backup-data         Include sample data rows in pre-mutation snapshots
  --audit-backup-max-size <b> Max table size in bytes for data capture (default: 50MB)

  --allowed-io-roots <paths>  Allowed input/output root directories (comma-separated or JSON array)

Other:
  --version, -v               Show version
  --help, -h                  Show this help

Environment Variables:
  MYSQL_HOST                  MySQL host
  MYSQL_PORT                  MySQL port
  MYSQL_USER                  MySQL username
  MYSQL_PASSWORD              MySQL password
  MYSQL_DATABASE              MySQL database
  MYSQL_POOL_SIZE             Connection pool size
  MYSQL_MCP_TOOL_FILTER       Tool filter string
  MCP_HOST                    Host to bind HTTP transport to
  MCP_AUTH_TOKEN               Simple bearer token for HTTP authentication
  TRUST_PROXY                  Trust X-Forwarded-For (true/false)
  MCP_ENABLE_HSTS              Enable HSTS header (same as --enable-hsts)
  MCP_METRICS_EXPORT           Enable metrics export endpoint (prometheus or true)
  ALLOWED_IO_ROOTS             Allowed input/output root directories
  LOG_LEVEL                   Log level (debug, info, warn, error)
  OAUTH_ENABLED               Enable OAuth (true/false)
  OAUTH_ISSUER                Authorization server URL
  OAUTH_AUDIENCE              Expected token audience
  OAUTH_JWKS_URI              JWKS endpoint URL
  OAUTH_CLOCK_TOLERANCE       Clock tolerance in seconds
  MYSQL_ROUTER_URL            MySQL Router URL
  MYSQL_ROUTER_USER           MySQL Router user
  MYSQL_ROUTER_PASSWORD       MySQL Router password
  MYSQL_ROUTER_INSECURE       Bypass Router TLS verification (true/false)
  PROXYSQL_HOST               ProxySQL host
  PROXYSQL_PORT               ProxySQL port
  PROXYSQL_USER               ProxySQL user
  PROXYSQL_PASSWORD           ProxySQL password
  MYSQLSH_PATH                Path to MySQL Shell executable
  MYSQL_XPORT                 MySQL X Protocol port (default 33060)
  CODEMODE_ISOLATION          Code mode isolation level
  CODE_MODE_MAX_RESULT_SIZE   Max Code Mode result payload in bytes
  METADATA_CACHE_TTL_MS       Cache TTL for schema metadata
  AUDIT_LOG_PATH              Path to JSONL audit log
  AUDIT_REDACT                Redact tool args from audit log
  AUDIT_READS                 Log read operations
  AUDIT_BACKUP                Enable pre-mutation DDL snapshots
  AUDIT_BACKUP_DATA           Include sample data in pre-mutation snapshots
  MYSQLMCP_PORT               Port for mysql-mcp
`);
}

/**
 * CLI Option Definitions — Single Source of Truth
 *
 * Every CLI flag is declared once here. Downstream consumers
 * (parseArgs config, help text, Zod schema) all derive from this.
 */

/** A single CLI option definition. */
export interface CliOptionDef {
  /** Long flag name without leading dashes (e.g. "mysql-host"). */
  readonly long: string;
  /** Optional single-character short alias (e.g. "m"). */
  readonly short?: string;
  /** parseArgs type — "string" or "boolean". */
  readonly type: "string" | "boolean";
  /** Allow repeated usage (e.g. `--mysql url1 --mysql url2`). */
  readonly multiple?: boolean;
  /** Human-readable description for help text. */
  readonly description: string;
  /** Default value shown in help text (display only). */
  readonly defaultValue?: string;
  /** Mapped environment variable(s), if any. */
  readonly envVar?: string;
  /** Logical group for help output. */
  readonly group: CliOptionGroup;
}

/** Logical groups that mirror the help text sections. */
export type CliOptionGroup =
  | "connection"
  | "pool"
  | "server"
  | "oauth"
  | "security"
  | "audit"
  | "io"
  | "other";

/**
 * Complete registry of every CLI flag the server accepts.
 * Keys are the long flag name (without leading dashes).
 */
export const CLI_OPTIONS: Record<string, CliOptionDef> = {
  // ── Connection ──────────────────────────────────────────────
  "mysql": {
    long: "mysql", short: "m", type: "string", multiple: true,
    description: "MySQL connection string (mysql://user:pass@host:port/database)",
    group: "connection",
  },
  "mysql-host": {
    long: "mysql-host", type: "string",
    description: "MySQL host", defaultValue: "localhost", envVar: "MYSQL_HOST",
    group: "connection",
  },
  "mysql-port": {
    long: "mysql-port", type: "string",
    description: "MySQL port", defaultValue: "3306", envVar: "MYSQL_PORT",
    group: "connection",
  },
  "mysql-user": {
    long: "mysql-user", type: "string",
    description: "MySQL username", envVar: "MYSQL_USER",
    group: "connection",
  },
  "mysql-password": {
    long: "mysql-password", type: "string",
    description: "MySQL password", envVar: "MYSQL_PASSWORD",
    group: "connection",
  },
  "mysql-database": {
    long: "mysql-database", type: "string",
    description: "MySQL database name", envVar: "MYSQL_DATABASE",
    group: "connection",
  },

  // ── Pool ────────────────────────────────────────────────────
  "pool-size": {
    long: "pool-size", type: "string",
    description: "Connection pool size", defaultValue: "10", envVar: "MYSQL_POOL_SIZE",
    group: "pool",
  },
  "pool-timeout": {
    long: "pool-timeout", type: "string",
    description: "Connection acquire timeout in ms", defaultValue: "30000",
    group: "pool",
  },
  "pool-queue-limit": {
    long: "pool-queue-limit", type: "string",
    description: "Queue limit for waiting requests", defaultValue: "0",
    group: "pool",
  },

  // ── Server ──────────────────────────────────────────────────
  "config": {
    long: "config", short: "c", type: "string",
    description: "Load configuration from YAML/JSON file",
    group: "server",
  },
  "dump-config": {
    long: "dump-config", type: "boolean",
    description: "Print the resolved configuration and exit",
    group: "server",
  },
  "transport": {
    long: "transport", short: "t", type: "string",
    description: "Transport type: stdio, http, sse", defaultValue: "stdio",
    group: "server",
  },
  "port": {
    long: "port", short: "p", type: "string",
    description: "HTTP port for http/sse transports", envVar: "MYSQLMCP_PORT",
    group: "server",
  },
  "server-host": {
    long: "server-host", type: "string",
    description: "Host to bind HTTP transport to", defaultValue: "localhost", envVar: "MCP_HOST",
    group: "server",
  },
  "tool-filter": {
    long: "tool-filter", short: "f", type: "string",
    description: "Tool filter string (e.g., \"-replication,-partitioning\")", envVar: "TOOL_FILTER",
    group: "server",
  },
  "name": {
    long: "name", type: "string",
    description: "Server name", defaultValue: "mysql-mcp",
    group: "server",
  },

  // ── OAuth ───────────────────────────────────────────────────
  "oauth-enabled": {
    long: "oauth-enabled", short: "o", type: "boolean",
    description: "Enable OAuth 2.1 authentication", envVar: "OAUTH_ENABLED",
    group: "oauth",
  },
  "oauth-issuer": {
    long: "oauth-issuer", type: "string",
    description: "Authorization server URL (issuer)", envVar: "OAUTH_ISSUER",
    group: "oauth",
  },
  "oauth-audience": {
    long: "oauth-audience", type: "string",
    description: "Expected token audience", envVar: "OAUTH_AUDIENCE",
    group: "oauth",
  },
  "oauth-jwks-uri": {
    long: "oauth-jwks-uri", type: "string",
    description: "JWKS URI (auto-discovered from issuer if not set)", envVar: "OAUTH_JWKS_URI",
    group: "oauth",
  },
  "oauth-clock-tolerance": {
    long: "oauth-clock-tolerance", type: "string",
    description: "Clock tolerance in seconds", defaultValue: "60", envVar: "OAUTH_CLOCK_TOLERANCE",
    group: "oauth",
  },

  // ── Authentication & Security ───────────────────────────────
  "auth-token": {
    long: "auth-token", type: "string",
    description: "Simple bearer token for HTTP authentication", envVar: "MCP_AUTH_TOKEN",
    group: "security",
  },
  "stateless": {
    long: "stateless", type: "boolean",
    description: "Enable stateless HTTP mode (no sessions, no SSE)",
    group: "security",
  },
  "enable-hsts": {
    long: "enable-hsts", type: "boolean",
    description: "Enable HSTS header (use when behind HTTPS)", envVar: "MCP_ENABLE_HSTS",
    group: "security",
  },
  "trust-proxy": {
    long: "trust-proxy", type: "boolean",
    description: "Trust X-Forwarded-For header for client IP", envVar: "TRUST_PROXY",
    group: "security",
  },
  "log-level": {
    long: "log-level", type: "string",
    description: "Log level: debug, info, warn, error", defaultValue: "info", envVar: "LOG_LEVEL",
    group: "security",
  },
  "metrics-export": {
    long: "metrics-export", type: "string",
    description: "Enable metrics export endpoint (prometheus)", envVar: "MCP_METRICS_EXPORT",
    group: "security",
  },

  // ── Audit ───────────────────────────────────────────────────
  "audit-log": {
    long: "audit-log", type: "string",
    description: "Path to JSONL audit log file (or 'stderr' to stream)",
    group: "audit",
  },
  "audit-redact": {
    long: "audit-redact", type: "boolean",
    description: "Redact tool arguments from audit log",
    group: "audit",
  },
  "audit-reads": {
    long: "audit-reads", type: "boolean",
    description: "Log read operations in addition to writes/admins",
    group: "audit",
  },
  "audit-log-max-size": {
    long: "audit-log-max-size", type: "string",
    description: "Max audit log size in bytes before rotation", defaultValue: "10485760",
    group: "audit",
  },
  "audit-backup": {
    long: "audit-backup", type: "boolean",
    description: "Enable pre-mutation DDL snapshots for destructive tools",
    group: "audit",
  },
  "audit-backup-data": {
    long: "audit-backup-data", type: "boolean",
    description: "Include sample data rows in pre-mutation snapshots",
    group: "audit",
  },
  "audit-backup-max-size": {
    long: "audit-backup-max-size", type: "string",
    description: "Max table size in bytes for data capture", defaultValue: "52428800",
    group: "audit",
  },

  // ── I/O ─────────────────────────────────────────────────────
  "allowed-io-roots": {
    long: "allowed-io-roots", type: "string",
    description: "Allowed I/O root directories (comma-separated or JSON array)",
    envVar: "ALLOWED_IO_ROOTS",
    group: "io",
  },

  // ── Other ───────────────────────────────────────────────────
  "version": {
    long: "version", short: "v", type: "boolean",
    description: "Show version",
    group: "other",
  },
  "help": {
    long: "help", short: "h", type: "boolean",
    description: "Show this help",
    group: "other",
  },
  "json": {
    long: "json", type: "boolean",
    description: "Output in JSON format (e.g. --help --json)",
    group: "other",
  },
} as const satisfies Record<string, CliOptionDef>;

/**
 * Derived config object ready for `util.parseArgs({ options })`.
 *
 * Shape per key: `{ type: "string"|"boolean", short?: string, multiple?: boolean }`
 */
export const PARSE_ARGS_CONFIG: Record<
  string,
  { type: "string" | "boolean"; short?: string; multiple?: boolean }
> = Object.fromEntries(
  Object.entries(CLI_OPTIONS).map(([key, def]) => {
    const entry: { type: "string" | "boolean"; short?: string; multiple?: boolean } = {
      type: def.type,
    };
    if (def.short) entry.short = def.short;
    if (def.multiple) entry.multiple = def.multiple;
    return [key, entry];
  }),
);

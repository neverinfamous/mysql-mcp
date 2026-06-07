import {
  parseMySQLConnectionString,
  DEFAULT_CONFIG,
} from "../server/mcp-server.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  PoolConfig,
  OAuthConfig,
} from "../types/index.js";
import { logger } from "../utils/logger.js";
import { parseAllowedIoRoots } from "../utils/security-utils.js";
import fs from "node:fs";
import yaml from "yaml";

/**
 * Load configuration from a JSON or YAML file
 */
function loadConfigFile(configPath: string): Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig } {
  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
      return yaml.parse(fileContent) as Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig };
    } else {
      return JSON.parse(fileContent) as Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig };
    }
  } catch (error) {
    logger.error(`Failed to load config file: ${configPath}`, {
      error: error instanceof Error ? error : new Error(String(error)),
      module: "CLI",
    });
    process.exit(1);
  }
}

/**
 * Load configuration from environment variables
 */
function loadEnvConfig(poolConfig: PoolConfig): { config: Partial<McpServerConfig>; databases: DatabaseConfig[]; oauth?: OAuthConfig } {
  const config: Partial<McpServerConfig> = {};
  const databases: DatabaseConfig[] = [];
  let oauth: OAuthConfig | undefined;

  // Check for server host in environment
  const host = process.env["MCP_HOST"] ?? process.env["HOST"];
  if (host) config.host = host;

  // Check for allowed IO roots in environment
  const allowedIoRoots = process.env["ALLOWED_IO_ROOTS"];
  if (allowedIoRoots) {
    config.allowedIoRoots = parseAllowedIoRoots(allowedIoRoots);
  }

  // Check trust proxy environment variable
  if (process.env["TRUST_PROXY"] === "true") {
    config.trustProxy = true;
  }

  // Check HSTS environment variable
  if (process.env["MCP_ENABLE_HSTS"] === "true") {
    config.enableHSTS = true;
  }

  // Check for tool filter in environment
  const toolFilter = process.env["MYSQL_MCP_TOOL_FILTER"] ?? process.env["TOOL_FILTER"];
  if (toolFilter) {
    config.toolFilter = toolFilter;
  }

  // Check auth token environment variable
  const authToken = process.env["MCP_AUTH_TOKEN"];
  if (authToken) {
    config.authToken = authToken;
  }

  // Check OAuth environment variables
  if (process.env["OAUTH_ENABLED"] === "true") {
    oauth = {
      enabled: true,
      authorizationServerUrl: process.env["OAUTH_ISSUER"],
      issuer: process.env["OAUTH_ISSUER"],
      audience: process.env["OAUTH_AUDIENCE"],
      jwksUri: process.env["OAUTH_JWKS_URI"],
      clockTolerance: process.env["OAUTH_CLOCK_TOLERANCE"] ? parseInt(process.env["OAUTH_CLOCK_TOLERANCE"], 10) : undefined,
    };
  }

  // Check audit environment variables
  const auditLogPath = process.env["AUDIT_LOG_PATH"];
  if (auditLogPath) {
    config.auditConfig = {
      enabled: true,
      logPath: auditLogPath,
      redact: process.env["AUDIT_REDACT"] === "true",
      auditReads: process.env["AUDIT_READS"] === "true",
      maxSizeBytes: 10 * 1024 * 1024,
    };

    if (process.env["AUDIT_BACKUP"] === "true") {
      config.auditConfig.backup = {
        enabled: true,
        includeData: process.env["AUDIT_BACKUP_DATA"] === "true",
        maxAgeDays: 30, // Fixed default for now
        maxCount: 1000, // Fixed default for now
        maxDataSizeBytes: 50 * 1024 * 1024,
      };
    }
  }

  // Check database environment variables as fallback
  const envHost = process.env["MYSQL_HOST"];
  const envUser = process.env["MYSQL_USER"];
  const envPassword = process.env["MYSQL_PASSWORD"];
  const envDatabase = process.env["MYSQL_DATABASE"];
  const envPort = process.env["MYSQL_PORT"];
  const envPoolSize = process.env["MYSQL_POOL_SIZE"];

  if (envHost && envUser && envDatabase) {
    const envPoolConfig = { ...poolConfig };
    if (envPoolSize) {
      envPoolConfig.connectionLimit = parseInt(envPoolSize, 10);
    }
    databases.push({
      type: "mysql",
      host: envHost,
      port: envPort ? parseInt(envPort, 10) : 3306,
      username: envUser,
      password: envPassword,
      database: envDatabase,
      pool: envPoolConfig,
    });
  }

  return { config, databases, oauth };
}

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): {
  config: Partial<McpServerConfig>;
  databases: DatabaseConfig[];
  oauth: OAuthConfig | undefined;
  shouldExit: boolean;
  dumpConfig?: boolean;
} {
  const args = argv;
  const cliConfig: Partial<McpServerConfig> = {};
  const cliDatabases: DatabaseConfig[] = [];
  
  // Default pool config
  const poolConfig: PoolConfig = {
    connectionLimit: 10,
    waitForConnections: true,
    queueLimit: 0,
  };

  // OAuth config
  let oauthEnabled = false;
  let oauthIssuer: string | undefined;
  let oauthAudience: string | undefined;
  let oauthJwksUri: string | undefined;
  let oauthClockTolerance: number | undefined;

  // MySQL connection params
  let mysqlHost: string | undefined;
  let mysqlPort = 3306;
  let mysqlUser: string | undefined;
  let mysqlPassword: string | undefined;
  let mysqlDatabase: string | undefined;

  // Audit config
  let auditLogPath: string | undefined;
  let auditRedact = false;
  let auditReads = false;
  let auditLogMaxSize = 10 * 1024 * 1024; // 10MB
  let auditBackup = false;
  let auditBackupData = false;
  let auditBackupMaxSize = 50 * 1024 * 1024; // 50MB

  let configPath: string | undefined;
  let dumpConfig = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--transport":
      case "-t":
        if (nextArg && !nextArg.startsWith("-")) {
          cliConfig.transport = nextArg as TransportType;
          i++;
        }
        break;

      case "--port":
      case "-p":
        if (nextArg && !nextArg.startsWith("-")) {
          cliConfig.port = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--server-host":
        if (nextArg && !nextArg.startsWith("-")) {
          cliConfig.host = nextArg;
          i++;
        }
        break;

      case "--mysql":
      case "-m":
        if (nextArg && !nextArg.startsWith("-")) {
          // Parse connection string
          const dbConfig = parseMySQLConnectionString(nextArg);
          dbConfig.pool = poolConfig;
          cliDatabases.push(dbConfig);
          i++;
        }
        break;

      case "--mysql-host":
        if (nextArg && !nextArg.startsWith("-")) {
          mysqlHost = nextArg;
          i++;
        }
        break;

      case "--mysql-port":
        if (nextArg && !nextArg.startsWith("-")) {
          mysqlPort = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--mysql-user":
        if (nextArg && !nextArg.startsWith("-")) {
          mysqlUser = nextArg;
          i++;
        }
        break;

      case "--mysql-password":
        if (nextArg && !nextArg.startsWith("-")) {
          mysqlPassword = nextArg;
          i++;
        }
        break;

      case "--mysql-database":
        if (nextArg && !nextArg.startsWith("-")) {
          mysqlDatabase = nextArg;
          i++;
        }
        break;

      case "--pool-size":
        if (nextArg && !nextArg.startsWith("-")) {
          poolConfig.connectionLimit = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--pool-timeout":
        if (nextArg && !nextArg.startsWith("-")) {
          poolConfig.acquireTimeout = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--pool-queue-limit":
        if (nextArg && !nextArg.startsWith("-")) {
          poolConfig.queueLimit = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--tool-filter":
      case "-f":
        if (nextArg !== undefined) {
          cliConfig.toolFilter = nextArg;
          i++;
        }
        break;

      case "--name":
        if (nextArg && !nextArg.startsWith("-")) {
          cliConfig.name = nextArg;
          i++;
        }
        break;

      case "--allowed-io-roots":
        if (nextArg !== undefined) {
          cliConfig.allowedIoRoots = parseAllowedIoRoots(nextArg);
          i++;
        }
        break;

      // OAuth options
      case "--oauth-enabled":
      case "-o":
        oauthEnabled = true;
        break;

      case "--oauth-issuer":
        if (nextArg && !nextArg.startsWith("-")) {
          oauthIssuer = nextArg;
          i++;
        }
        break;

      case "--oauth-audience":
        if (nextArg && !nextArg.startsWith("-")) {
          oauthAudience = nextArg;
          i++;
        }
        break;

      case "--oauth-jwks-uri":
        if (nextArg && !nextArg.startsWith("-")) {
          oauthJwksUri = nextArg;
          i++;
        }
        break;

      case "--oauth-clock-tolerance":
        if (nextArg && !nextArg.startsWith("-")) {
          oauthClockTolerance = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--auth-token":
        if (nextArg && !nextArg.startsWith("-")) {
          cliConfig.authToken = nextArg;
          i++;
        }
        break;

      case "--stateless":
        cliConfig.stateless = true;
        break;

      case "--enable-hsts":
        cliConfig.enableHSTS = true;
        break;

      case "--trust-proxy":
        cliConfig.trustProxy = true;
        break;

      case "--log-level":
        if (nextArg && !nextArg.startsWith("-")) {
          const level = nextArg.toLowerCase();
          const mapped = level === "warn" ? "warning" : level;
          const validLevels = ["debug", "info", "warning", "error"];
          if (validLevels.includes(mapped)) {
            logger.setLevel(mapped as "debug" | "info" | "warning" | "error");
          }
          i++;
        }
        break;

      // Audit options
      case "--audit-log":
        if (nextArg && !nextArg.startsWith("-")) {
          auditLogPath = nextArg;
          i++;
        }
        break;
      case "--audit-redact":
        auditRedact = true;
        break;
      case "--audit-reads":
        auditReads = true;
        break;
      case "--audit-log-max-size":
        if (nextArg && !nextArg.startsWith("-")) {
          auditLogMaxSize = parseInt(nextArg, 10);
          i++;
        }
        break;
      case "--audit-backup":
        auditBackup = true;
        break;
      case "--audit-backup-data":
        auditBackupData = true;
        break;
      case "--audit-backup-max-size":
        if (nextArg && !nextArg.startsWith("-")) {
          auditBackupMaxSize = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--config":
      case "-c":
        if (nextArg && !nextArg.startsWith("-")) {
          configPath = nextArg;
          i++;
        }
        break;

      case "--dump-config":
        dumpConfig = true;
        break;

      case "--version":
      case "-v":
        console.error(`mysql-mcp version ${DEFAULT_CONFIG.version}`);
        return { config: {}, databases: [], oauth: undefined, shouldExit: true };

      case "--help":
      case "-h":
        printHelp();
        return { config: {}, databases: [], oauth: undefined, shouldExit: true };

      default:
        if (arg?.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  // Build database config from individual params if provided
  if (mysqlHost || mysqlUser || mysqlDatabase) {
    if (!mysqlHost) mysqlHost = process.env["MYSQL_HOST"] ?? "localhost";
    if (!mysqlUser) mysqlUser = process.env["MYSQL_USER"];
    if (!mysqlPassword) mysqlPassword = process.env["MYSQL_PASSWORD"];
    if (!mysqlDatabase) mysqlDatabase = process.env["MYSQL_DATABASE"];

    if (mysqlUser && mysqlDatabase) {
      cliDatabases.push({
        type: "mysql",
        host: mysqlHost,
        port: mysqlPort,
        username: mysqlUser,
        password: mysqlPassword,
        database: mysqlDatabase,
        pool: poolConfig,
      });
    }
  }

  // Build OAuth config if enabled
  let cliOauth: OAuthConfig | undefined;
  if (oauthEnabled || oauthIssuer || oauthAudience || oauthJwksUri || oauthClockTolerance !== undefined) {
    cliOauth = {
      enabled: true,
      authorizationServerUrl: oauthIssuer,
      issuer: oauthIssuer,
      audience: oauthAudience,
      jwksUri: oauthJwksUri,
      clockTolerance: oauthClockTolerance,
    };
  }

  // Build audit config if enabled
  if (auditLogPath) {
    cliConfig.auditConfig = {
      enabled: true,
      logPath: auditLogPath,
      redact: auditRedact,
      auditReads: auditReads,
      maxSizeBytes: auditLogMaxSize,
    };

    if (auditBackup) {
      cliConfig.auditConfig.backup = {
        enabled: true,
        includeData: auditBackupData,
        maxAgeDays: 30, // Fixed default for now
        maxCount: 1000, // Fixed default for now
        maxDataSizeBytes: auditBackupMaxSize,
      };
    }
  }

  // Load config file if specified
  const fileConfigData: Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig } = configPath ? loadConfigFile(configPath) : {};
  const { databases: fileDatabases = [], oauth: fileOauth, ...fileConfig } = fileConfigData;

  // Load configuration from environment
  const { config: envConfig, databases: envDatabases, oauth: envOauth } = loadEnvConfig(poolConfig);

  // Merge Config Priority: CLI > ENV > FILE > DEFAULTS
  const config = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
    ...cliConfig,
  };

  // Merge Databases Priority: CLI > ENV > FILE
  // Only use ONE source for databases to avoid connecting to a random mix of local and prod.
  let databases: DatabaseConfig[] = [];
  if (cliDatabases.length > 0) {
    databases = cliDatabases;
  } else if (envDatabases.length > 0) {
    databases = envDatabases;
  } else if (fileDatabases.length > 0) {
    databases = fileDatabases;
  }

  // Merge OAuth Priority: CLI > ENV > FILE
  let oauth: OAuthConfig | undefined;
  if (cliOauth?.enabled) {
    oauth = cliOauth;
  } else if (envOauth?.enabled) {
    oauth = envOauth;
  } else if (fileOauth?.enabled) {
    oauth = fileOauth;
  }

  return { config, databases, oauth, shouldExit: false, dumpConfig };
}

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
  --pool-timeout <ms>         Connection acquire timeout (default: 10000)
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
  ALLOWED_IO_ROOTS             Allowed input/output root directories
  LOG_LEVEL                   Log level (debug, info, warn, error)
  OAUTH_ENABLED               Enable OAuth (true/false)
  OAUTH_ISSUER                Authorization server URL
  OAUTH_AUDIENCE              Expected token audience
  OAUTH_JWKS_URI              JWKS endpoint URL
  OAUTH_CLOCK_TOLERANCE       Clock tolerance in seconds
`);
}

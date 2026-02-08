import {
  parseMySQLConnectionString,
  DEFAULT_CONFIG,
} from "../server/McpServer.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  PoolConfig,
  OAuthConfig,
} from "../types/index.js";

/**
 * Parse command line arguments
 */
export function parseArgs(argv: string[] = process.argv.slice(2)): {
  config: Partial<McpServerConfig>;
  databases: DatabaseConfig[];
  oauth: OAuthConfig | undefined;
  shouldExit: boolean;
} {
  const args = argv;
  const config: Partial<McpServerConfig> = {};
  const databases: DatabaseConfig[] = [];

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

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--transport":
      case "-t":
        if (nextArg && !nextArg.startsWith("-")) {
          config.transport = nextArg as TransportType;
          i++;
        }
        break;

      case "--port":
      case "-p":
        if (nextArg && !nextArg.startsWith("-")) {
          config.port = parseInt(nextArg, 10);
          i++;
        }
        break;

      case "--mysql":
      case "-m":
        if (nextArg && !nextArg.startsWith("-")) {
          // Parse connection string
          const dbConfig = parseMySQLConnectionString(nextArg);
          dbConfig.pool = poolConfig;
          databases.push(dbConfig);
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
        // Note: tool filter values can start with '-' (e.g., "-base,-ecosystem,+starter")
        // so we can't use the usual !nextArg.startsWith('-') check
        if (nextArg !== undefined) {
          config.toolFilter = nextArg;
          i++;
        }
        break;

      case "--name":
        if (nextArg && !nextArg.startsWith("-")) {
          config.name = nextArg;
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

      case "--version":
      case "-v":
        console.error(`mysql-mcp version ${DEFAULT_CONFIG.version}`);
        return { config, databases, oauth: undefined, shouldExit: true };

      case "--help":
      case "-h":
        printHelp();
        return { config, databases, oauth: undefined, shouldExit: true };

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
    // Check required fields
    if (!mysqlHost) {
      mysqlHost = process.env["MYSQL_HOST"] ?? "localhost";
    }
    if (!mysqlUser) {
      mysqlUser = process.env["MYSQL_USER"];
    }
    if (!mysqlPassword) {
      mysqlPassword = process.env["MYSQL_PASSWORD"];
    }
    if (!mysqlDatabase) {
      mysqlDatabase = process.env["MYSQL_DATABASE"];
    }

    if (mysqlUser && mysqlDatabase) {
      databases.push({
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

  // Check environment variables as fallback
  if (databases.length === 0) {
    const envHost = process.env["MYSQL_HOST"];
    const envUser = process.env["MYSQL_USER"];
    const envPassword = process.env["MYSQL_PASSWORD"];
    const envDatabase = process.env["MYSQL_DATABASE"];
    const envPort = process.env["MYSQL_PORT"];
    const envPoolSize = process.env["MYSQL_POOL_SIZE"];

    if (envHost && envUser && envDatabase) {
      if (envPoolSize) {
        poolConfig.connectionLimit = parseInt(envPoolSize, 10);
      }
      databases.push({
        type: "mysql",
        host: envHost,
        port: envPort ? parseInt(envPort, 10) : 3306,
        username: envUser,
        password: envPassword,
        database: envDatabase,
        pool: poolConfig,
      });
    }
  }

  // Check for tool filter in environment
  if (!config.toolFilter) {
    config.toolFilter =
      process.env["MYSQL_MCP_TOOL_FILTER"] ?? process.env["TOOL_FILTER"];
  }

  // Check OAuth environment variables
  if (!oauthEnabled && process.env["OAUTH_ENABLED"] === "true") {
    oauthEnabled = true;
  }
  if (!oauthIssuer) {
    oauthIssuer = process.env["OAUTH_ISSUER"];
  }
  if (!oauthAudience) {
    oauthAudience = process.env["OAUTH_AUDIENCE"];
  }
  if (!oauthJwksUri) {
    oauthJwksUri = process.env["OAUTH_JWKS_URI"];
  }
  if (
    oauthClockTolerance === undefined &&
    process.env["OAUTH_CLOCK_TOLERANCE"]
  ) {
    oauthClockTolerance = parseInt(process.env["OAUTH_CLOCK_TOLERANCE"], 10);
  }

  // Build OAuth config if enabled
  let oauth: OAuthConfig | undefined;
  if (oauthEnabled) {
    oauth = {
      enabled: true,
      authorizationServerUrl: oauthIssuer,
      issuer: oauthIssuer,
      audience: oauthAudience,
      jwksUri: oauthJwksUri,
      clockTolerance: oauthClockTolerance,
    };
  }

  return { config, databases, oauth, shouldExit: false };
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
  --transport, -t <type>      Transport type: stdio, http, sse (default: stdio)
  --port, -p <port>           HTTP port for http/sse transports
  --tool-filter, -f <filter>  Tool filter string (e.g., "-replication,-partitioning")
  --name <name>               Server name (default: mysql-mcp)

OAuth Options:
  --oauth-enabled, -o         Enable OAuth 2.0 authentication
  --oauth-issuer <url>        Authorization server URL (issuer)
  --oauth-audience <aud>      Expected token audience
  --oauth-jwks-uri <url>      JWKS URI (auto-discovered from issuer if not set)
  --oauth-clock-tolerance <s> Clock tolerance in seconds (default: 60)

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
  LOG_LEVEL                   Log level (debug, info, warn, error)
  OAUTH_ENABLED               Enable OAuth (true/false)
  OAUTH_ISSUER                Authorization server URL
  OAUTH_AUDIENCE              Expected token audience
  OAUTH_JWKS_URI              JWKS endpoint URL
  OAUTH_CLOCK_TOLERANCE       Clock tolerance in seconds
`);
}

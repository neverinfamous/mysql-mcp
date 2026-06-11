import {
  parseMySQLConnectionString,
  DEFAULT_CONFIG,
} from "../../server/mcp-server/index.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  PoolConfig,
  OAuthConfig,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { parseAllowedIoRoots } from "../../utils/security-utils.js";
import { loadConfigFile } from "./load-config-file.js";
import { loadEnvConfig } from "./load-env-config.js";
import { printHelp } from "./print-help.js";

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

      case "--metrics-export":
        if (nextArg && !nextArg.startsWith("-")) {
          cliConfig.metricsExport = nextArg === "prometheus" ? "prometheus" : (nextArg === "true");
          i++;
        } else {
          cliConfig.metricsExport = true;
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

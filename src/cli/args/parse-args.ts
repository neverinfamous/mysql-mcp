/**
 * CLI argument parsing — node:util parseArgs + Zod validation boundary.
 *
 * Replaces the manual for/switch parser with the stdlib parser
 * backed by the Phase 1 option registry and Zod coercion.
 */
import { parseArgs as nodeParseArgs } from "node:util";

import { PARSE_ARGS_CONFIG, CLI_OPTIONS } from "./cli-options.js";
import { validateCliArgs } from "./cli-schema.js";
import {
  parseMySQLConnectionString,
  DEFAULT_CONFIG,
} from "../../server/mcp-server/index.js";
import type {
  McpServerConfig,
  DatabaseConfig,
  PoolConfig,
  OAuthConfig,
} from "../../types/index.js";
import { logger } from "../../utils/logger.js";
import { parseAllowedIoRoots } from "../../utils/security-utils.js";
import { loadConfigFile } from "./load-config-file.js";
import { loadEnvConfig } from "./load-env-config.js";
import { printHelp } from "./print-help.js";
import { cliVersion } from "../output.js";

/**
 * Parse command line arguments
 */
export async function parseArgs(argv: string[] = process.argv.slice(2)): Promise<{
  config: Partial<McpServerConfig>;
  databases: DatabaseConfig[];
  oauth: OAuthConfig | undefined;
  shouldExit: boolean;
  dumpConfig?: boolean;
}> {
  // ── Early exits (before strict parsing) ──────────────────────
  // Check --help / -h first so strict mode doesn't reject unknown combos
  if (argv.includes("--help") || argv.includes("-h")) {
    if (argv.includes("--json")) {
      process.stdout.write(JSON.stringify(CLI_OPTIONS, null, 2) + "\n");
    } else {
      printHelp();
    }
    return { config: {}, databases: [], oauth: undefined, shouldExit: true };
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    cliVersion(DEFAULT_CONFIG.version);
    return { config: {}, databases: [], oauth: undefined, shouldExit: true };
  }

  // ── Parse with node:util ─────────────────────────────────────
  let values: Record<string, string | boolean | string[] | undefined>;
  try {
    const result = nodeParseArgs({
      args: argv,
      options: PARSE_ARGS_CONFIG,
      strict: true,
      allowPositionals: false,
    });
    values = result.values as Record<string, string | boolean | string[] | undefined>;
  } catch (err: unknown) {
    const code = (err instanceof Error && "code" in err)
      ? (err as NodeJS.ErrnoException).code
      : undefined;
    if (
      code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" ||
      code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE"
    ) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${msg}\n`);
      printHelp();
      process.exit(1);
    }
    throw err;
  }

  // ── Validate with Zod ────────────────────────────────────────
  let validated;
  try {
    validated = validateCliArgs(values);
  } catch (err: unknown) {
    if (err instanceof Error) {
      process.stderr.write(`Validation error: ${err.message}\n`);
    }
    process.exit(1);
  }

  // ── Build configs from validated args ────────────────────────
  const cliConfig: Partial<McpServerConfig> = {};
  const cliDatabases: DatabaseConfig[] = [];
  let configPath: string | undefined;
  let dumpConfig = false;

  // Pool config
  const poolConfig: PoolConfig = {
    connectionLimit: validated["pool-size"] ?? 10,
    waitForConnections: true,
    queueLimit: validated["pool-queue-limit"] ?? 0,
  };
  if (validated["pool-timeout"] !== undefined) {
    poolConfig.acquireTimeout = validated["pool-timeout"];
  }

  // Config path
  if (validated.config) {
    configPath = validated.config;
  }

  // Dump config
  if (validated["dump-config"]) {
    dumpConfig = true;
  }

  // MySQL from connection strings (--mysql can be multiple)
  if (validated.mysql) {
    for (const connStr of validated.mysql) {
      const dbConfig = parseMySQLConnectionString(connStr);
      dbConfig.pool = poolConfig;
      cliDatabases.push(dbConfig);
    }
  }

  // MySQL from individual flags
  const mysqlHost = validated["mysql-host"];
  const mysqlPort = validated["mysql-port"] ?? 3306;
  const mysqlUser = validated["mysql-user"];
  const mysqlPassword = validated["mysql-password"];
  const mysqlDatabase = validated["mysql-database"];

  if (mysqlHost || mysqlUser || mysqlDatabase) {
    const host = mysqlHost ?? process.env["MYSQL_HOST"] ?? "localhost";
    const user = mysqlUser ?? process.env["MYSQL_USER"];
    const password = mysqlPassword ?? process.env["MYSQL_PASSWORD"];
    const database = mysqlDatabase ?? process.env["MYSQL_DATABASE"];

    if (user && database) {
      cliDatabases.push({
        type: "mysql",
        host,
        port: mysqlPort,
        username: user,
        password,
        database,
        pool: poolConfig,
      });
    }
  }

  // OAuth config
  let cliOauth: OAuthConfig | undefined;
  if (
    validated["oauth-enabled"] ||
    validated["oauth-issuer"] ||
    validated["oauth-audience"] ||
    validated["oauth-jwks-uri"] ||
    validated["oauth-clock-tolerance"] !== undefined
  ) {
    cliOauth = {
      enabled: true,
      authorizationServerUrl: validated["oauth-issuer"],
      issuer: validated["oauth-issuer"],
      audience: validated["oauth-audience"],
      jwksUri: validated["oauth-jwks-uri"],
      clockTolerance: validated["oauth-clock-tolerance"],
    };
  }

  // Audit config
  if (validated["audit-log"]) {
    cliConfig.auditConfig = {
      enabled: true,
      logPath: validated["audit-log"],
      redact: validated["audit-redact"] ?? false,
      auditReads: validated["audit-reads"] ?? false,
      maxSizeBytes: validated["audit-log-max-size"] ?? 10 * 1024 * 1024,
    };
    if (validated["audit-backup"]) {
      cliConfig.auditConfig.backup = {
        enabled: true,
        includeData: validated["audit-backup-data"] ?? false,
        maxAgeDays: 30,
        maxCount: 1000,
        maxDataSizeBytes: validated["audit-backup-max-size"] ?? 50 * 1024 * 1024,
      };
    }
  }

  // Metrics export
  if (validated["metrics-export"] !== undefined) {
    cliConfig.metricsExport =
      validated["metrics-export"] === "prometheus" ? "prometheus" : true;
  }

  // Simple scalar mappings
  if (validated.transport) cliConfig.transport = validated.transport;
  if (validated.port !== undefined) cliConfig.port = validated.port;
  if (validated["server-host"]) cliConfig.host = validated["server-host"];
  if (validated["tool-filter"]) cliConfig.toolFilter = validated["tool-filter"];
  if (validated.name) cliConfig.name = validated.name;
  if (validated["auth-token"]) cliConfig.authToken = validated["auth-token"];
  if (validated.stateless) cliConfig.stateless = true;
  if (validated["enable-hsts"]) cliConfig.enableHSTS = true;
  if (validated["trust-proxy"]) cliConfig.trustProxy = true;

  // Allowed IO roots
  if (validated["allowed-io-roots"]) {
    cliConfig.allowedIoRoots = parseAllowedIoRoots(validated["allowed-io-roots"]);
  }

  // Log level
  if (validated["log-level"]) {
    logger.setLevel(validated["log-level"]);
  }

  // ── Merge: CLI > ENV > FILE > DEFAULTS ───────────────────────

  // Load config file if specified
  const fileConfigData: Partial<McpServerConfig> & { databases?: DatabaseConfig[]; oauth?: OAuthConfig } =
    configPath ? await loadConfigFile(configPath) : {};
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

import { parseAllowedIoRoots } from "../../utils/security-utils.js";
import type {
  McpServerConfig,
  DatabaseConfig,
  PoolConfig,
  OAuthConfig,
} from "../../types/index.js";

/**
 * Load configuration from environment variables
 */
export function loadEnvConfig(poolConfig: PoolConfig): { config: Partial<McpServerConfig>; databases: DatabaseConfig[]; oauth?: OAuthConfig } {
  const config: Partial<McpServerConfig> = {};
  const databases: DatabaseConfig[] = [];
  let oauth: OAuthConfig | undefined;

  // Check for server host in environment
  const host = process.env["MCP_HOST"] ?? process.env["HOST"];
  if (host) config.host = host;

  // Check for server port in environment
  const port = process.env["MYSQLMCP_PORT"] ?? process.env["PORT"];
  if (port) config.port = parseInt(port, 10);

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

  // Check metrics export environment variable
  const metricsExport = process.env["MCP_METRICS_EXPORT"];
  if (metricsExport) {
    config.metricsExport = metricsExport === "prometheus" ? "prometheus" : (metricsExport === "true");
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
      maxSizeBytes: process.env["AUDIT_LOG_MAX_SIZE"] ? parseInt(process.env["AUDIT_LOG_MAX_SIZE"], 10) : (10 * 1024 * 1024),
    };

    if (process.env["AUDIT_BACKUP"] === "true") {
      config.auditConfig.backup = {
        enabled: true,
        includeData: process.env["AUDIT_BACKUP_DATA"] === "true",
        maxAgeDays: 30, // Fixed default for now
        maxCount: 1000, // Fixed default for now
        maxDataSizeBytes: process.env["AUDIT_BACKUP_MAX_SIZE"] ? parseInt(process.env["AUDIT_BACKUP_MAX_SIZE"], 10) : (50 * 1024 * 1024),
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

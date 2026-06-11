import type { McpServerConfig, DatabaseConfig } from "../../types/index.js";
import { VERSION } from "../../version.js";

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG: McpServerConfig = {
  name: "mysql-mcp",
  version: VERSION,
  transport: "stdio",
  databases: [],
};

/**
 * Parse database configuration from connection string
 */
export function parseMySQLConnectionString(
  connectionString: string,
): DatabaseConfig {
  // Parse mysql://user:password@host:port/database
  const url = new URL(connectionString);

  return {
    type: "mysql",
    host: url.hostname,
    port: parseInt(url.port, 10) || 3306,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.slice(1), // Remove leading /
    options: Object.fromEntries(url.searchParams),
  };
}

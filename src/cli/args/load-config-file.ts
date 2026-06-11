import { logger } from "../../utils/logger.js";
import fs from "node:fs";
import yaml from "yaml";
import type {
  McpServerConfig,
  DatabaseConfig,
  OAuthConfig,
} from "../../types/index.js";

/**
 * Load configuration from a JSON or YAML file
 */
export function loadConfigFile(configPath: string): Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig } {
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

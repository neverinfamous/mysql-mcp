import { logger } from "../../utils/logger.js";
import fs from "node:fs";
import yaml from "yaml";
import { z } from "zod";
import type {
  McpServerConfig,
  DatabaseConfig,
  OAuthConfig,
} from "../../types/index.js";

const ConfigFileSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  transport: z.enum(["stdio", "http", "sse"]).optional(),
  port: z.number().optional(),
  host: z.string().optional(),
  databases: z.array(z.record(z.string(), z.unknown())).optional(),
  oauth: z.record(z.string(), z.unknown()).optional(),
  authToken: z.string().optional(),
  stateless: z.boolean().optional(),
  enableHSTS: z.boolean().optional(),
  trustProxy: z.boolean().optional(),
  metricsExport: z.union([z.literal("prometheus"), z.boolean()]).optional(),
  toolFilter: z.string().optional(),
  auditConfig: z.record(z.string(), z.unknown()).optional(),
  allowedIoRoots: z.array(z.string()).optional(),
}).loose();

/**
 * Load configuration from a JSON or YAML file
 */
export function loadConfigFile(configPath: string): Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig } {
  try {
    const fileContent = fs.readFileSync(configPath, "utf-8");
    let parsed: unknown;
    if (configPath.endsWith(".yaml") || configPath.endsWith(".yml")) {
      parsed = yaml.parse(fileContent);
    } else {
      parsed = JSON.parse(fileContent);
    }
    
    // Validate config at the boundary
    const validated = ConfigFileSchema.parse(parsed);
    
    // We can safely return this matching our expected types, 
    // letting Zod handle the boundary validation
    return validated as unknown as Partial<McpServerConfig> & { databases?: DatabaseConfig[], oauth?: OAuthConfig };
  } catch (error) {
    logger.error(`Failed to load config file: ${configPath}`, {
      error: error instanceof Error ? error : new Error(String(error)),
      module: "CLI",
    });
    process.exit(1);
  }
}

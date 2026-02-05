#!/usr/bin/env node
/**
 * mysql-mcp - Command Line Interface
 *
 * Entry point for running the mysql-mcp server from the command line.
 */

import { createServer } from "./server/McpServer.js";
import { MySQLAdapter } from "./adapters/mysql/MySQLAdapter.js";
import type {
  McpServerConfig,
  DatabaseConfig,
  OAuthConfig,
} from "./types/index.js";
import { parseArgs } from "./cli/args.js";
import { logger } from "./utils/logger.js";

/**
 * Tool groups that don't require a MySQL database connection.
 * These tools connect to external services via HTTP/CLI.
 */
const MYSQL_OPTIONAL_GROUPS = new Set(["router", "proxysql", "shell"]);

/**
 * Check if the tool filter only includes groups that don't need MySQL connection.
 * Returns true if MySQL connection can be skipped.
 */
function canSkipMySQLConnection(toolFilter: string | undefined): boolean {
  if (!toolFilter) return false;

  // Parse the filter to extract enabled groups
  // Format examples: "router", "router,proxysql", "ecosystem", "-core,router"
  const parts = toolFilter.split(",").map((p) => p.trim().toLowerCase());

  // If using shortcuts that include MySQL-requiring tools, need connection
  const shortcutsRequiringMySQL = [
    "starter",
    "essential",
    "dev-power",
    "ai-data",
    "ai-spatial",
    "dba-monitor",
    "dba-manage",
    "dba-secure",
    "base-core",
    "base-advanced",
  ];

  // Check if any shortcut requiring MySQL is used
  for (const part of parts) {
    const cleanPart = part.replace(/^[+-]/, "");
    if (shortcutsRequiringMySQL.includes(cleanPart)) {
      return false;
    }
  }

  // Get all positive (included) groups
  const enabledGroups = new Set<string>();
  for (const part of parts) {
    if (part.startsWith("-")) continue; // Skip exclusions
    const cleanPart = part.replace(/^[+]/, "");

    // 'ecosystem' shortcut = router + proxysql + shell (no MySQL needed)
    if (cleanPart === "ecosystem") {
      enabledGroups.add("router");
      enabledGroups.add("proxysql");
      enabledGroups.add("shell");
    } else {
      enabledGroups.add(cleanPart);
    }
  }

  // If no enabled groups found, can't skip
  if (enabledGroups.size === 0) return false;

  // Check if ALL enabled groups are MySQL-optional
  for (const group of enabledGroups) {
    if (!MYSQL_OPTIONAL_GROUPS.has(group)) {
      return false;
    }
  }

  return true;
}

/**
 * Main entry point
 */
export async function main(args?: {
  config: Partial<McpServerConfig>;
  databases: DatabaseConfig[];
  oauth: OAuthConfig | undefined;
  shouldExit?: boolean;
}): Promise<void> {
  const { config, databases, oauth, shouldExit } = args ?? parseArgs();

  if (shouldExit) {
    process.exit(0);
  }

  // Check if MySQL connection can be skipped based on tool filter
  const skipMySQLConnection = canSkipMySQLConnection(config.toolFilter);

  if (databases.length === 0 && !skipMySQLConnection) {
    console.error("Error: No database connection specified");
    console.error(
      "Use --mysql or environment variables to configure connection",
    );
    console.error("Run with --help for usage information");
    process.exit(1);
  }

  // Log OAuth status (without exposing sensitive configuration)
  if (oauth?.enabled) {
    console.error("OAuth authentication enabled");
  }

  // Create server
  const server = createServer({
    ...config,
    databases,
    oauth,
  });

  // Handle graceful shutdown
  const shutdown = async (): Promise<never> => {
    console.error("\nShutting down...");
    await server.stop();
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    // Create and connect adapters
    for (const dbConfig of databases) {
      if (dbConfig.type === "mysql") {
        const adapter = new MySQLAdapter();

        if (skipMySQLConnection) {
          // Register adapter without connecting for external-only tools
          logger.info(
            "Skipping MySQL connection (not needed for selected tools)",
            {
              toolFilter: config.toolFilter,
            },
          );
          server.registerAdapter(
            adapter,
            `mysql:${dbConfig.database ?? "default"}`,
          );
        } else {
          // Normal flow: connect then register
          await adapter.connect(dbConfig);
          server.registerAdapter(
            adapter,
            `mysql:${dbConfig.database ?? "default"}`,
          );
        }
      }
    }

    // If no databases configured but using external-only tools, create a placeholder adapter
    if (databases.length === 0 && skipMySQLConnection) {
      logger.info("Running without MySQL connection (external tools only)", {
        toolFilter: config.toolFilter,
      });
      const adapter = new MySQLAdapter();
      server.registerAdapter(adapter, "mysql:external");
    }

    // Start server
    await server.start();
  } catch (error) {
    console.error("Fatal error:", error);
    process.exit(1);
  }
}

// Run if called directly
import { fileURLToPath } from "url";

// Only run if this file is the main module
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  main().catch(console.error);
}

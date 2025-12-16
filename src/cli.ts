#!/usr/bin/env node
/**
 * mysql-mcp - Command Line Interface
 * 
 * Entry point for running the mysql-mcp server from the command line.
 */

import { createServer } from './server/McpServer.js';
import { MySQLAdapter } from './adapters/mysql/MySQLAdapter.js';
import type { McpServerConfig, DatabaseConfig, OAuthConfig } from './types/index.js';
import { parseArgs } from './cli/args.js';

/**
 * Main entry point
 */
export async function main(
    args?: {
        config: Partial<McpServerConfig>;
        databases: DatabaseConfig[];
        oauth: OAuthConfig | undefined;
        shouldExit?: boolean;
    }
): Promise<void> {
    const { config, databases, oauth, shouldExit } = args ?? parseArgs();

    if (shouldExit) {
        process.exit(0);
    }

    if (databases.length === 0) {
        console.error('Error: No database connection specified');
        console.error('Use --mysql or environment variables to configure connection');
        console.error('Run with --help for usage information');
        process.exit(1);
    }

    // Log OAuth status
    if (oauth?.enabled) {
        console.error(`OAuth enabled: issuer=${oauth.issuer ?? 'not set'}, audience=${oauth.audience ?? 'not set'}`);
    }

    // Create server
    const server = createServer({
        ...config,
        databases,
        oauth
    });

    // Handle graceful shutdown
    const shutdown = async (): Promise<never> => {
        console.error('\nShutting down...');
        await server.stop();
        process.exit(0);
    };

    process.on('SIGINT', () => void shutdown());
    process.on('SIGTERM', () => void shutdown());

    try {
        // Create and connect adapters
        for (const dbConfig of databases) {
            if (dbConfig.type === 'mysql') {
                const adapter = new MySQLAdapter();
                await adapter.connect(dbConfig);
                server.registerAdapter(adapter, `mysql:${dbConfig.database ?? 'default'}`);
            }
        }

        // Start server
        await server.start();
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

// Run if called directly
import { fileURLToPath } from 'url';

// Only run if this file is the main module
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
    main().catch(console.error);
}

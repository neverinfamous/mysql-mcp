#!/usr/bin/env node
/**
 * mysql-mcp - Command Line Interface
 * 
 * Entry point for running the mysql-mcp server from the command line.
 */

import { createServer, parseMySQLConnectionString, DEFAULT_CONFIG } from './server/McpServer.js';
import { MySQLAdapter } from './adapters/mysql/MySQLAdapter.js';
import type { McpServerConfig, TransportType, DatabaseConfig, PoolConfig } from './types/index.js';

/**
 * Parse command line arguments
 */
function parseArgs(): {
    config: Partial<McpServerConfig>;
    databases: DatabaseConfig[];
} {
    const args = process.argv.slice(2);
    const config: Partial<McpServerConfig> = {};
    const databases: DatabaseConfig[] = [];

    // Default pool config
    const poolConfig: PoolConfig = {
        connectionLimit: 10,
        waitForConnections: true,
        queueLimit: 0
    };

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
            case '--transport':
            case '-t':
                if (nextArg && !nextArg.startsWith('-')) {
                    config.transport = nextArg as TransportType;
                    i++;
                }
                break;

            case '--port':
            case '-p':
                if (nextArg && !nextArg.startsWith('-')) {
                    config.port = parseInt(nextArg, 10);
                    i++;
                }
                break;

            case '--mysql':
            case '-m':
                if (nextArg && !nextArg.startsWith('-')) {
                    // Parse connection string
                    const dbConfig = parseMySQLConnectionString(nextArg);
                    dbConfig.pool = poolConfig;
                    databases.push(dbConfig);
                    i++;
                }
                break;

            case '--mysql-host':
                if (nextArg && !nextArg.startsWith('-')) {
                    mysqlHost = nextArg;
                    i++;
                }
                break;

            case '--mysql-port':
                if (nextArg && !nextArg.startsWith('-')) {
                    mysqlPort = parseInt(nextArg, 10);
                    i++;
                }
                break;

            case '--mysql-user':
                if (nextArg && !nextArg.startsWith('-')) {
                    mysqlUser = nextArg;
                    i++;
                }
                break;

            case '--mysql-password':
                if (nextArg && !nextArg.startsWith('-')) {
                    mysqlPassword = nextArg;
                    i++;
                }
                break;

            case '--mysql-database':
                if (nextArg && !nextArg.startsWith('-')) {
                    mysqlDatabase = nextArg;
                    i++;
                }
                break;

            case '--pool-size':
                if (nextArg && !nextArg.startsWith('-')) {
                    poolConfig.connectionLimit = parseInt(nextArg, 10);
                    i++;
                }
                break;

            case '--pool-timeout':
                if (nextArg && !nextArg.startsWith('-')) {
                    poolConfig.acquireTimeout = parseInt(nextArg, 10);
                    i++;
                }
                break;

            case '--pool-queue-limit':
                if (nextArg && !nextArg.startsWith('-')) {
                    poolConfig.queueLimit = parseInt(nextArg, 10);
                    i++;
                }
                break;

            case '--tool-filter':
            case '-f':
                if (nextArg && !nextArg.startsWith('-')) {
                    config.toolFilter = nextArg;
                    i++;
                }
                break;

            case '--name':
                if (nextArg && !nextArg.startsWith('-')) {
                    config.name = nextArg;
                    i++;
                }
                break;

            case '--version':
            case '-v':
                console.error(`mysql-mcp version ${DEFAULT_CONFIG.version}`);
                process.exit(0);
            // Falls through intentionally (unreachable due to process.exit)
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
            // Falls through intentionally (unreachable due to process.exit)
            default:
                if (arg?.startsWith('-')) {
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
            mysqlHost = process.env['MYSQL_HOST'] ?? 'localhost';
        }
        if (!mysqlUser) {
            mysqlUser = process.env['MYSQL_USER'];
        }
        if (!mysqlPassword) {
            mysqlPassword = process.env['MYSQL_PASSWORD'];
        }
        if (!mysqlDatabase) {
            mysqlDatabase = process.env['MYSQL_DATABASE'];
        }

        if (mysqlUser && mysqlDatabase) {
            databases.push({
                type: 'mysql',
                host: mysqlHost,
                port: mysqlPort,
                username: mysqlUser,
                password: mysqlPassword,
                database: mysqlDatabase,
                pool: poolConfig
            });
        }
    }

    // Check environment variables as fallback
    if (databases.length === 0) {
        const envHost = process.env['MYSQL_HOST'];
        const envUser = process.env['MYSQL_USER'];
        const envPassword = process.env['MYSQL_PASSWORD'];
        const envDatabase = process.env['MYSQL_DATABASE'];
        const envPort = process.env['MYSQL_PORT'];
        const envPoolSize = process.env['MYSQL_POOL_SIZE'];

        if (envHost && envUser && envDatabase) {
            if (envPoolSize) {
                poolConfig.connectionLimit = parseInt(envPoolSize, 10);
            }
            databases.push({
                type: 'mysql',
                host: envHost,
                port: envPort ? parseInt(envPort, 10) : 3306,
                username: envUser,
                password: envPassword,
                database: envDatabase,
                pool: poolConfig
            });
        }
    }

    // Check for tool filter in environment
    if (!config.toolFilter) {
        config.toolFilter = process.env['MYSQL_MCP_TOOL_FILTER'] ?? process.env['TOOL_FILTER'];
    }

    return { config, databases };
}

/**
 * Print help message
 */
function printHelp(): void {
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

Examples:
  # Connect with URL
  mysql-mcp --transport stdio --mysql mysql://root:password@localhost:3306/mydb

  # Connect with individual params
  mysql-mcp --transport stdio --mysql-host localhost --mysql-user root \\
            --mysql-password secret --mysql-database mydb

  # With tool filtering
  mysql-mcp --mysql mysql://root:pass@localhost/db \\
            --tool-filter "-replication,-partitioning,-backup"

  # With larger connection pool
  mysql-mcp --mysql mysql://root:pass@localhost/db --pool-size 20
`);
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const { config, databases } = parseArgs();

    if (databases.length === 0) {
        console.error('Error: No database connection specified');
        console.error('Use --mysql or environment variables to configure connection');
        console.error('Run with --help for usage information');
        process.exit(1);
    }

    // Create server
    const server = createServer({
        ...config,
        databases
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

// Run
main().catch(console.error);

/**
 * mysql-mcp - MCP Server
 * 
 * Main MCP server implementation with adapter registration,
 * tool filtering, and transport handling.
 */

import { McpServer as SdkMcpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { DatabaseAdapter } from '../adapters/DatabaseAdapter.js';
import type { McpServerConfig, TransportType, DatabaseConfig, ToolFilterConfig } from '../types/index.js';
import { parseToolFilter, getFilterSummary } from '../filtering/ToolFilter.js';
import { logger } from '../utils/logger.js';

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG: McpServerConfig = {
    name: 'mysql-mcp',
    version: '0.1.0',
    transport: 'stdio',
    databases: []
};

/**
 * MySQL MCP Server
 */
export class McpServer {
    private server: SdkMcpServer;
    private adapters = new Map<string, DatabaseAdapter>();
    private config: McpServerConfig;
    private toolFilter: ToolFilterConfig;
    private started = false;

    constructor(config: Partial<McpServerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.toolFilter = parseToolFilter(this.config.toolFilter);

        this.server = new SdkMcpServer({
            name: this.config.name,
            version: this.config.version
        });

        // Log tool filter summary
        if (this.toolFilter.rules.length > 0) {
            logger.info(getFilterSummary(this.toolFilter));
        }
    }

    /**
     * Register a database adapter
     */
    registerAdapter(adapter: DatabaseAdapter, alias?: string): void {
        const key = alias ?? `${adapter.type}:default`;

        if (this.adapters.has(key)) {
            logger.warn(`Adapter already registered: ${key}`);
            return;
        }

        this.adapters.set(key, adapter);

        // Register adapter's tools, resources, and prompts
        adapter.registerTools(this.server, this.toolFilter.enabledTools);
        adapter.registerResources(this.server);
        adapter.registerPrompts(this.server);

        logger.info(`Registered adapter: ${adapter.name} (${key})`);
    }

    /**
     * Get a registered adapter by key
     */
    getAdapter(key: string): DatabaseAdapter | undefined {
        return this.adapters.get(key);
    }

    /**
     * Get all registered adapters
     */
    getAdapters(): Map<string, DatabaseAdapter> {
        return this.adapters;
    }

    /**
     * Start the MCP server
     */
    async start(): Promise<void> {
        if (this.started) {
            logger.warn('Server already started');
            return;
        }

        logger.info('Starting MCP server...');

        try {
            await this.startTransport(this.config.transport);
            this.started = true;
            logger.info('Server started successfully');
        } catch (error) {
            logger.error('Failed to start server', { error: String(error) });
            throw error;
        }
    }

    /**
     * Start the specified transport
     */
    private async startTransport(transport: TransportType): Promise<void> {
        switch (transport) {
            case 'stdio':
                await this.startStdioTransport();
                break;
            case 'http':
            case 'sse':
                // HTTP/SSE transport would be implemented here
                throw new Error(`Transport '${transport}' not yet implemented`);
            default:
                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                throw new Error(`Unknown transport: ${transport}`);
        }
    }

    /**
     * Start stdio transport
     */
    private async startStdioTransport(): Promise<void> {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
    }

    /**
     * Stop the MCP server
     */
    async stop(): Promise<void> {
        if (!this.started) {
            return;
        }

        logger.info('Stopping MCP server...');

        // Disconnect all adapters
        for (const [key, adapter] of this.adapters) {
            try {
                await adapter.disconnect();
                logger.info(`Disconnected adapter: ${key}`);
            } catch (error) {
                logger.error(`Error disconnecting adapter ${key}`, { error: String(error) });
            }
        }

        await this.server.close();
        this.started = false;
        logger.info('Server stopped');
    }

    /**
     * Get server configuration
     */
    getConfig(): McpServerConfig {
        return { ...this.config };
    }

    /**
     * Get tool filter configuration
     */
    getToolFilter(): ToolFilterConfig {
        return this.toolFilter;
    }

    /**
     * Check if server is running
     */
    isRunning(): boolean {
        return this.started;
    }

    /**
     * Get the underlying MCP SDK server instance
     */
    getSdkServer(): SdkMcpServer {
        return this.server;
    }
}

/**
 * Create a new MCP server instance
 */
export function createServer(config: Partial<McpServerConfig> = {}): McpServer {
    return new McpServer(config);
}

/**
 * Parse database configuration from connection string
 */
export function parseMySQLConnectionString(connectionString: string): DatabaseConfig {
    // Parse mysql://user:password@host:port/database
    const url = new URL(connectionString);

    return {
        type: 'mysql',
        host: url.hostname,
        port: parseInt(url.port, 10) || 3306,
        username: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.slice(1), // Remove leading /
        options: Object.fromEntries(url.searchParams)
    };
}

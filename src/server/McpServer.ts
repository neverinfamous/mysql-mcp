/**
 * mysql-mcp - MCP Server
 *
 * Main MCP server implementation with adapter registration,
 * tool filtering, and transport handling.
 */

import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { generateInstructions } from "../constants/ServerInstructions.js";
import type { DatabaseAdapter } from "../adapters/DatabaseAdapter.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  ToolFilterConfig,
} from "../types/index.js";
import { parseToolFilter, getFilterSummary } from "../filtering/ToolFilter.js";
import { logger } from "../utils/logger.js";
import { mcpLogger } from "../logging/McpLogging.js";
import { progressFactory } from "../progress/ProgressReporter.js";
import { OAuthResourceServer } from "../auth/OAuthResourceServer.js";
import { TokenValidator } from "../auth/TokenValidator.js";

/**
 * Default server configuration
 */
export const DEFAULT_CONFIG: McpServerConfig = {
  name: "mysql-mcp",
  version: "0.1.0",
  transport: "stdio",
  databases: [],
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
  private activeTransport: { stop(): Promise<void> } | null = null;

  constructor(config: Partial<McpServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolFilter = parseToolFilter(this.config.toolFilter);

    // Generate dynamic instructions based on enabled tools
    const instructions = generateInstructions(
      this.toolFilter.enabledTools,
      [], // Resources will be added when adapter is registered
      [], // Prompts will be added when adapter is registered
    );

    this.server = new SdkMcpServer(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          logging: {},
        },
        instructions,
      },
    );

    // Initialize MCP protocol logging so clients can receive log messages
    mcpLogger.setServer(this.server);

    // Initialize MCP protocol progress reporting for long-running operations
    progressFactory.setServer(this.server);

    // Log tool filter summary
    if (this.toolFilter.rules.length > 0) {
      logger.info(getFilterSummary(this.toolFilter));
    }

    // Log server initialization with capabilities
    logger.info("MCP Server initialized", {
      name: this.config.name,
      version: this.config.version,
      toolFilter: this.config.toolFilter ?? "none",
      capabilities: ["logging"],
    });
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

    // Get counts before registration
    const allTools = adapter.getToolDefinitions();
    const allResources = adapter.getResourceDefinitions();
    const allPrompts = adapter.getPromptDefinitions();

    // Register adapter's tools, resources, and prompts
    adapter.registerTools(this.server, this.toolFilter.enabledTools);
    adapter.registerResources(this.server);
    adapter.registerPrompts(this.server);

    // Count enabled tools
    const enabledToolCount = allTools.filter((t) =>
      this.toolFilter.enabledTools.has(t.name),
    ).length;

    logger.info(`Registered adapter: ${adapter.name} (${key})`);
    logger.info(`  Tools: ${enabledToolCount}/${allTools.length} enabled`);
    logger.info(`  Resources: ${allResources.length}`);
    logger.info(`  Prompts: ${allPrompts.length}`);
    mcpLogger.info(
      `Database adapter registered: ${adapter.name} (${enabledToolCount} tools, ${allResources.length} resources, ${allPrompts.length} prompts)`,
    );
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
      logger.warn("Server already started");
      return;
    }

    logger.info("Starting MCP server...");

    try {
      await this.startTransport(this.config.transport);
      this.started = true;

      // Enable MCP protocol logging now that transport is connected
      mcpLogger.setConnected(true);

      logger.info("Server started successfully");
      mcpLogger.info("MySQL MCP server ready", {
        transport: this.config.transport,
      });
    } catch (error) {
      logger.error("Failed to start server", { error: String(error) });
      throw error;
    }
  }

  /**
   * Start the specified transport
   */
  private async startTransport(transport: TransportType): Promise<void> {
    switch (transport) {
      case "stdio":
        await this.startStdioTransport();
        break;
      case "http":
      case "sse": {
        const { createHttpTransport } = await import("../transports/http.js");
        const port = this.config.port ?? 3000;

        const transport = createHttpTransport(
          {
            port,
            host: this.config.host ?? "localhost",
            corsOrigins: ["*"], // Allow all for now, or make configurable
            // Pass OAuth config if enabled
            ...(this.config.oauth?.enabled
              ? {
                  resourceServer: this.createOAuthResourceServer(),
                  tokenValidator: this.createTokenValidator(),
                }
              : {}),
          },
          (sseTransport) => {
            logger.info("New SSE connection");
            void this.server.connect(sseTransport);
          },
        );

        await transport.start();
        this.activeTransport = transport;
        break;
      }
      default:
        throw new Error(`Unknown transport: ${String(transport)}`);
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

    logger.info("Stopping MCP server...");

    // Disable MCP logging before disconnecting
    mcpLogger.setConnected(false);

    // Disconnect all adapters
    for (const [key, adapter] of this.adapters) {
      try {
        await adapter.disconnect();
        logger.info(`Disconnected adapter: ${key}`);
      } catch (error) {
        logger.error(`Error disconnecting adapter ${key}`, {
          error: String(error),
        });
      }
    }

    if (this.activeTransport) {
      try {
        await this.activeTransport.stop();
      } catch (error) {
        logger.error("Error stopping transport", { error: String(error) });
      }
      this.activeTransport = null;
    }

    await this.server.close();
    this.started = false;
    logger.info("Server stopped");
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

  /**
   * Create OAuth resource server from config
   */
  private createOAuthResourceServer(): OAuthResourceServer {
    if (!this.config.oauth?.enabled) {
      throw new Error("OAuth is not enabled");
    }

    // Use audience as resource ID if not explicitly configured in future
    const resourceId = this.config.oauth.audience ?? "mysql-mcp";

    const issuer = this.config.oauth.issuer;
    if (!issuer) {
      throw new Error("OAuth issuer is required");
    }

    return new OAuthResourceServer({
      resource: resourceId,
      authorizationServers: [issuer],
      scopesSupported: ["read", "write", "admin"],
      bearerMethodsSupported: ["header"],
    });
  }

  /**
   * Create token validator from config
   */
  private createTokenValidator(): TokenValidator {
    if (!this.config.oauth?.enabled) {
      throw new Error("OAuth is not enabled");
    }

    if (!this.config.oauth.jwksUri) {
      throw new Error("OAuth JWKS URI is required for validation");
    }

    const issuer = this.config.oauth.issuer;
    const audience = this.config.oauth.audience;
    if (!issuer || !audience) {
      throw new Error("OAuth issuer and audience are required");
    }

    return new TokenValidator({
      issuer,
      audience,
      jwksUri: this.config.oauth.jwksUri,
      clockTolerance: this.config.oauth.clockTolerance,
    });
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

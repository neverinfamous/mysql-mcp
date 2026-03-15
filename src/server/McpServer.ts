/**
 * mysql-mcp - MCP Server
 *
 * Main MCP server implementation with adapter registration,
 * tool filtering, and transport handling.
 */

import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { INSTRUCTIONS, HELP_CONTENT } from "../constants/server-instructions.js";
import { TOOL_GROUPS } from "../filtering/ToolConstants.js";
import type { DatabaseAdapter } from "../adapters/DatabaseAdapter.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  ToolFilterConfig,
  ToolGroup,
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
    const instructions = INSTRUCTIONS;

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

    // Register help resources (mysql://help and mysql://help/{group})
    this.registerHelpResources();

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

      // For stdio, enable MCP protocol logging immediately (client connected during startTransport)
      // For HTTP/SSE, defer until a client actually connects (see onConnect callback in startTransport)
      if (this.config.transport === "stdio") {
        mcpLogger.setConnected(true);
        mcpLogger.info("MySQL MCP server ready", {
          transport: this.config.transport,
        });
      }

      logger.info("Server started successfully");
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
        const { createHttpTransport } = await import("../transports/http/index.js");
        const port = this.config.port ?? 3000;

        const httpTransport = createHttpTransport(
          {
            port,
            host: this.config.host ?? "localhost",
            corsOrigins: ["*"], // Allow all for now, or make configurable
            ...(this.config.authToken
              ? { authToken: this.config.authToken }
              : {}),
            stateless: this.config.stateless ?? false,
            trustProxy: this.config.trustProxy ?? false,
            // Pass OAuth config if enabled
            ...(this.config.oauth?.enabled
              ? {
                  resourceServer: this.createOAuthResourceServer(),
                  tokenValidator: this.createTokenValidator(),
                }
              : {}),
          },
          async (mcpTransport) => {
            logger.info("New client connection");
            const server = this.server;
            if (server.isConnected()) {
              await server.close();
            }
            await server.connect(mcpTransport);

            // Enable MCP protocol logging now that a client is actually connected
            mcpLogger.setConnected(true);
            mcpLogger.info("MySQL MCP server ready", {
              transport: this.config.transport,
            });
          },
        );

        // Warn if HTTP starts without any authentication
        if (!this.config.oauth?.enabled && !this.config.authToken) {
          logger.warn(
            "WARNING: HTTP transport started without authentication. " +
              "Use --oauth-enabled or --auth-token for production deployments.",
          );
        }

        await httpTransport.start();
        this.activeTransport = httpTransport;
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

  /**
   * Register mysql://help resources for on-demand reference documentation.
   * Always registers mysql://help (gotchas). Group-specific help is filtered
   * by the tool filter configuration.
   */
  private registerHelpResources(): void {
    // Always register mysql://help (gotchas + code mode + aliases)
    const gotchasContent = HELP_CONTENT.get("gotchas");
    if (gotchasContent) {
      this.server.registerResource(
        "mysql_help",
        "mysql://help",
        {
          description: "Critical gotchas, parameter aliases, and Code Mode API reference",
          mimeType: "text/markdown",
        },
        () => ({
          contents: [{
            uri: "mysql://help",
            mimeType: "text/markdown",
            text: gotchasContent,
          }],
        }),
      );
    }

    // Derive enabled groups from enabled tools
    const enabledGroups = new Set<ToolGroup>();
    for (const [group, tools] of Object.entries(TOOL_GROUPS) as [ToolGroup, string[]][]) {
      if (tools.some((tool) => this.toolFilter.enabledTools.has(tool))) {
        enabledGroups.add(group);
      }
    }

    // Register group-specific help resources based on tool filter
    const groupHelpKeys: { group: ToolGroup; key: string }[] = [
      { group: "core", key: "core" },
      { group: "json", key: "json" },
      { group: "transactions", key: "transactions" },
      { group: "text", key: "text" },
      { group: "fulltext", key: "fulltext" },
      { group: "stats", key: "stats" },
      { group: "spatial", key: "spatial" },
      { group: "admin", key: "admin" },
      { group: "monitoring", key: "monitoring" },
      { group: "performance", key: "performance" },
      { group: "optimization", key: "optimization" },
      { group: "backup", key: "backup" },
      { group: "replication", key: "replication" },
      { group: "partitioning", key: "partitioning" },
      { group: "schema", key: "schema" },
      { group: "events", key: "events" },
      { group: "sysschema", key: "sysschema" },
      { group: "security", key: "security" },
      { group: "roles", key: "roles" },
      { group: "docstore", key: "docstore" },
      { group: "cluster", key: "cluster" },
      { group: "proxysql", key: "proxysql" },
      { group: "router", key: "router" },
      { group: "shell", key: "shell" },
    ];

    for (const { group, key } of groupHelpKeys) {
      if (!enabledGroups.has(group)) continue;

      const content = HELP_CONTENT.get(key);
      if (!content) continue;

      this.server.registerResource(
        `mysql_help_${key}`,
        `mysql://help/${key}`,
        {
          description: `Tool reference for the ${group} tool group`,
          mimeType: "text/markdown",
        },
        () => ({
          contents: [{
            uri: `mysql://help/${key}`,
            mimeType: "text/markdown",
            text: content,
          }],
        }),
      );
    }

    // Log registered help resources
    const registeredHelp = ["mysql://help"];
    for (const { group, key } of groupHelpKeys) {
      if (enabledGroups.has(group)) {
        registeredHelp.push(`mysql://help/${key}`);
      }
    }
    logger.info(`Help resources: ${registeredHelp.join(", ")}`);
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

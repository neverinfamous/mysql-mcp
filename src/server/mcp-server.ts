/**
 * mysql-mcp - MCP Server
 *
 * Main MCP server implementation with adapter registration,
 * tool filtering, and transport handling.
 */

import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  INSTRUCTIONS,
  HELP_CONTENT,
} from "../constants/server-instructions.js";
import { VERSION } from "../version.js";
import { TOOL_GROUPS } from "../filtering/tool-constants.js";
import type { DatabaseAdapter } from "../adapters/database-adapter.js";
import {
  McpError,
  ErrorCode,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { SubscriptionManager } from "./subscription-manager.js";
import type {
  McpServerConfig,
  TransportType,
  DatabaseConfig,
  ToolFilterConfig,
  ToolGroup,
} from "../types/index.js";
import {
  parseToolFilter,
  getFilterSummary,
  getEnabledGroups,
} from "../filtering/tool-filter.js";
import { logger } from "../utils/logger.js";
import { mcpLogger } from "../logging/mcp-logging.js";
import { progressFactory } from "../progress/progress-reporter.js";
import { OAuthResourceServer } from "../auth/oauth-resource-server.js";
import { TokenValidator } from "../auth/token-validator.js";
import { AuditLogger } from "../audit/logger.js";
import { BackupManager } from "../audit/backup-manager.js";
import { createAuditInterceptor } from "../audit/interceptor.js";
import { registerAdminTools } from "./admin-tools.js";
import { metrics } from "../observability/metrics.js";
import { SystemDb } from "../observability/system-db.js";

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
 * MySQL MCP Server
 */
export class McpServer {
  private server: SdkMcpServer;
  private adapters = new Map<string, DatabaseAdapter>();
  private config: McpServerConfig;
  private toolFilter: ToolFilterConfig;
  private started = false;
  private activeTransport: { stop(): Promise<void> } | null = null;
  private auditLogger: AuditLogger | null = null;
  private backupManager: BackupManager | null = null;
  private systemDb: SystemDb | null = null;
  private systemDbInitPromise: Promise<void> | null = null;
  public readonly subscriptionManager: SubscriptionManager;
  private healthInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<McpServerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.toolFilter = parseToolFilter(this.config.toolFilter);

    // Use static instructions
    const instructions = INSTRUCTIONS;

    this.server = new SdkMcpServer(
      {
        name: this.config.name,
        version: this.config.version,
      },
      {
        capabilities: {
          logging: {},
          resources: {
            subscribe: true,
          },
        },
        instructions,
      },
    );

    this.subscriptionManager = new SubscriptionManager(this.server);

    // Handle subscribe request
    this.server.server.setRequestHandler(
      SubscribeRequestSchema,
      (request, extra) => {
        const uri = request.params.uri;
        let sessionId =
          extra.sessionId ??
          extra.requestInfo?.headers["mcp-session-id"] ??
          undefined;

        sessionId ??= "default";

        // Allow subscriptions to schema, tables, health, and dynamic table URIs
        if (
          !["mysql://schema", "mysql://tables", "mysql://health"].includes(
            uri,
          ) &&
          !uri.startsWith("mysql://table/")
        ) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Resource ${uri} is not subscribable`,
          );
        }

        this.subscriptionManager.subscribe(
          uri,
          sessionId as string | undefined,
        );
        return {};
      },
    );

    // Handle unsubscribe request
    this.server.server.setRequestHandler(
      UnsubscribeRequestSchema,
      (request, extra) => {
        const uri = request.params.uri;
        let sessionId =
          extra.sessionId ??
          extra.requestInfo?.headers["mcp-session-id"] ??
          undefined;

        sessionId ??= "default";

        this.subscriptionManager.unsubscribe(
          uri,
          sessionId as string | undefined,
        );
        return {};
      },
    );

    // Periodically push health updates if there are subscribers
    this.healthInterval = setInterval(() => {
      if (this.subscriptionManager.hasSubscribers("mysql://health")) {
        void this.subscriptionManager.notifyResourceUpdated("mysql://health");
      }
    }, 60_000);
    this.healthInterval.unref();

    // Register help resources (mysql://help and mysql://help/{group})
    this.registerHelpResources();

    // Register observability resources
    this.registerObservabilityResource();

    // Initialize MCP protocol logging so clients can receive log messages
    mcpLogger.setServer(this.server);

    // Initialize Audit Subsystem
    if (this.config.auditConfig?.enabled) {
      this.auditLogger = new AuditLogger(this.config.auditConfig);
      if (this.config.auditConfig.backup?.enabled) {
        this.backupManager = new BackupManager(
          this.config.auditConfig.backup,
          this.config.auditConfig.logPath,
        );
      }
      this.registerAuditResource();

      if (this.config.auditConfig.logPath !== "stderr") {
        const dbPath = this.config.auditConfig.logPath.replace(/\.jsonl$/, '') + '.sqlite';
        const db = new SystemDb({ dbPath });
        this.systemDb = db;
        this.systemDbInitPromise = db.init().then(() => {
          metrics.setSystemDb(db);
          this.auditLogger?.setSystemDb(db);
        }).catch((err: unknown) => {
          logger.error("Failed to initialize SystemDb", { error: String(err) });
        });
      }
    }

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

    // Register admin tools if the admin group is enabled
    const enabledGroups = getEnabledGroups(this.toolFilter.enabledTools);
    if (enabledGroups.has("admin")) {
      registerAdminTools(this.server);
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

    // Get counts before registration
    const allTools = adapter.getToolDefinitions();
    const allResources = adapter.getResourceDefinitions();
    const allPrompts = adapter.getPromptDefinitions();

    // Wire up audit interceptor
    if (this.auditLogger) {
      const interceptor = createAuditInterceptor(
        this.auditLogger,
        this.backupManager ?? undefined,
        adapter,
      );
      adapter.setAuditInterceptor(interceptor);
      adapter.setAuditLogger(this.auditLogger);
      if (this.backupManager) {
        adapter.setBackupManager(this.backupManager);
      }
    }

    // Configure security boundaries
    adapter.setAllowedIoRoots(this.config.allowedIoRoots);

    // Register adapter's tools, resources, and prompts
    adapter.registerTools(this.server, this.toolFilter.enabledTools);
    adapter.registerResources(this.server);
    adapter.registerPrompts(this.server);

    // Wire up schema changed event to push resource updates
    adapter.on("schemaChanged", () => {
      void this.subscriptionManager.notifySchemaSubscribers();
    });

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

    if (this.systemDbInitPromise) {
      await this.systemDbInitPromise;
    }

    logger.info("Starting MCP server...");

    // Hard-gate missing security configuration for HTTP transports
    if (
      (this.config.transport === "http" || this.config.transport === "sse") &&
      (!this.config.allowedIoRoots || this.config.allowedIoRoots.length === 0)
    ) {
      logger.error(
        "CRITICAL SECURITY ERROR: HTTP transport requires ALLOWED_IO_ROOTS to be configured.",
      );
      process.exit(1);
    }

    if (!this.config.allowedIoRoots || this.config.allowedIoRoots.length === 0) {
      logger.warn(
        "SECURITY WARNING: ALLOWED_IO_ROOTS is empty. Tools that require filesystem access will be blocked.",
      );
    }

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
        const { createHttpTransport } =
          await import("../transports/http/index.js");
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
            ...(this.config.metricsExport !== undefined
              ? { metricsExport: this.config.metricsExport }
              : {}),
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
        throw new McpError(
          ErrorCode.InvalidRequest,
          `Unknown transport: ${String(transport)}`,
        );
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

    if (this.backupManager) {
      await this.backupManager.flush();
    }
    if (this.auditLogger) {
      await this.auditLogger.close();
    }
    metrics.close();
    if (this.systemDb) {
      this.systemDb.close();
    }

    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
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
      throw new McpError(ErrorCode.InvalidParams, "OAuth is not enabled");
    }

    // Use audience as resource ID if not explicitly configured in future
    const resourceId = this.config.oauth.audience ?? "mysql-mcp";

    const issuer = this.config.oauth.issuer;
    if (!issuer) {
      throw new McpError(ErrorCode.InvalidParams, "OAuth issuer is required");
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
      throw new McpError(ErrorCode.InvalidParams, "OAuth is not enabled");
    }

    if (!this.config.oauth.jwksUri) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "OAuth JWKS URI is required for validation",
      );
    }

    const issuer = this.config.oauth.issuer;
    const audience = this.config.oauth.audience;
    if (!issuer || !audience) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "OAuth issuer and audience are required",
      );
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
          description:
            "Critical gotchas, parameter aliases, and Code Mode API reference",
          mimeType: "text/markdown",
        },
        () => {
          metrics.recordResourceRead("mysql://help");
          return {
            contents: [
              {
                uri: "mysql://help",
                mimeType: "text/markdown",
                text: gotchasContent,
              },
            ],
          };
        },
      );
    }

    // Derive enabled groups from enabled tools
    const enabledGroups = getEnabledGroups(this.toolFilter.enabledTools);

    // If Code Mode is enabled, it exposes the full API surface area via the sandbox,
    // so we must register all help resources for the agent to reference.
    if (enabledGroups.has("codemode")) {
      for (const group of Object.keys(TOOL_GROUPS)) {
        enabledGroups.add(group as ToolGroup);
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
      { group: "introspection", key: "introspection" },
      { group: "migration", key: "migration" },
      { group: "events", key: "events" },
      { group: "sysschema", key: "sysschema" },
      { group: "security", key: "security" },
      { group: "roles", key: "roles" },
      { group: "docstore", key: "docstore" },
      { group: "cluster", key: "cluster" },
      { group: "proxysql", key: "proxysql" },
      { group: "router", key: "router" },
      { group: "shell", key: "shell" },
      { group: "vector", key: "vector" },
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
        () => {
          metrics.recordResourceRead(`mysql://help/${key}`);
          return {
            contents: [
              {
                uri: `mysql://help/${key}`,
                mimeType: "text/markdown",
                text: content,
              },
            ],
          };
        },
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

  /**
   * Register mysql://audit resource for forensic trail and snapshots.
   */
  private registerAuditResource(): void {
    if (!this.auditLogger) return;

    this.server.registerResource(
      "mysql_audit",
      "mysql://audit",
      {
        description:
          "Recent forensic audit trail and pre-mutation snapshot stats",
        mimeType: "application/json",
      },
      async () => {
        metrics.recordResourceRead("mysql://audit");
        if (!this.auditLogger) return { contents: [] };

        const recent = await this.auditLogger.recent(100);
        const backupStats = this.backupManager
          ? await this.backupManager.getStats()
          : undefined;

        let tokenEstimate = 0;
        let errors = 0;
        const tools: Record<string, number> = {};

        for (const entry of recent) {
          if (entry.tokenEstimate != null) tokenEstimate += entry.tokenEstimate;
          if (!entry.success) errors++;
          tools[entry.tool] = (tools[entry.tool] ?? 0) + 1;
        }

        const summary = {
          entries: recent.length,
          errors,
          tokenEstimate,
          topTools: Object.entries(tools)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count })),
          ...(backupStats && { backups: backupStats }),
        };

        return {
          contents: [
            {
              uri: "mysql://audit",
              mimeType: "application/json",
              text: JSON.stringify({ summary, recent }, null, 2),
            },
          ],
        };
      },
    );
    logger.info("Registered audit resource: mysql://audit");
  }

  /**
   * Register mysql://metrics resource for in-memory telemetry
   */
  private registerObservabilityResource(): void {
    this.server.registerResource(
      "mysql_metrics",
      "mysql://metrics",
      {
        description: "In-memory streaming metrics including p50/p95/p99 latency and token usage",
        mimeType: "application/json",
      },
      () => {
        metrics.recordResourceRead("mysql://metrics");
        const summary = metrics.getSummary();
        return {
          contents: [
            {
              uri: "mysql://metrics",
              mimeType: "application/json",
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      },
    );
    logger.info("Registered observability resource: mysql://metrics");
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

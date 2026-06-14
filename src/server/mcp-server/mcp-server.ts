/**
 * mysql-mcp - MCP Server
 *
 * Main MCP server implementation with adapter registration,
 * tool filtering, and transport handling.
 */

import { McpServer as SdkMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { INSTRUCTIONS } from "../../constants/server-instructions.js";
import type { DatabaseAdapter } from "../../adapters/database-adapter/index.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SubscriptionManager } from "../subscription-manager.js";
import type { McpServerConfig, TransportType, ToolFilterConfig } from "../../types/index.js";
import { parseToolFilter, getFilterSummary } from "../../filtering/tool-filter.js";
import { logger } from "../../utils/logger.js";
import { mcpLogger } from "../../logging/mcp-logging.js";
import { progressFactory } from "../../progress/progress-reporter.js";
import { AuditLogger } from "../../audit/logger.js";
import { BackupManager } from "../../audit/backup-manager/index.js";
import { createAuditInterceptor } from "../../audit/interceptor.js";
import { metrics } from "../../observability/metrics.js";
import { SystemDb } from "../../observability/system-db.js";

import { applySdkPatch } from "./sdk-patch.js";
import { DEFAULT_CONFIG } from "./config.js";
import { createOAuthResourceServer, createTokenValidator } from "./auth.js";
import { registerHelpResources, registerAuditResource, registerObservabilityResource } from "./resources.js";
import { setupSubscriptions } from "./subscriptions.js";

// Apply SDK Monkey patch
applySdkPatch();

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
        instructions: INSTRUCTIONS,
      },
    );

    this.subscriptionManager = new SubscriptionManager(this.server);
    setupSubscriptions(this.server, this.subscriptionManager);

    // Periodically push health updates if there are subscribers
    this.healthInterval = setInterval(() => {
      if (this.subscriptionManager.hasSubscribers("mysql://health")) {
        void this.subscriptionManager.notifyResourceUpdated("mysql://health");
      }
    }, 60_000);
    this.healthInterval.unref();

    // Register resources
    registerHelpResources(this.server, this.toolFilter.enabledTools);
    registerObservabilityResource(this.server);

    // Initialize MCP protocol logging
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
      registerAuditResource(this.server, this.auditLogger, this.backupManager);

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

    // Initialize MCP protocol progress reporting
    progressFactory.setServer(this.server);

    // Log tool filter summary
    if (this.toolFilter.rules.length > 0) {
      logger.info(getFilterSummary(this.toolFilter));
    }

    // Log server initialization
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

    const allTools = adapter.getToolDefinitions();
    const allResources = adapter.getResourceDefinitions();
    const allPrompts = adapter.getPromptDefinitions();

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

    adapter.setAllowedIoRoots(this.config.allowedIoRoots);

    adapter.registerTools(this.server, this.toolFilter.enabledTools);
    adapter.registerResources(this.server);
    adapter.registerPrompts(this.server);

    adapter.on("schemaChanged", () => {
      void this.subscriptionManager.notifySchemaSubscribers();
    });

    const enabledToolCount = allTools.filter((t) =>
      this.toolFilter.enabledTools.has(t.name),
    ).length;

    if (!this.config.toolFilter && enabledToolCount > 50) {
      logger.warn(`CONTEXT BLOAT WARNING: ${enabledToolCount} tools are being registered without a tool filter.`);
      logger.warn(`  This may consume excessive context window in the LLM. Consider using '--tool-filter codemode' or '--tool-filter starter' to save tokens.`);
    }

    logger.info(`Registered adapter: ${adapter.name} (${key})`);
    logger.info(`  Tools: ${enabledToolCount}/${allTools.length} enabled`);
    logger.info(`  Resources: ${allResources.length}`);
    logger.info(`  Prompts: ${allPrompts.length}`);
    mcpLogger.info(
      `Database adapter registered: ${adapter.name} (${enabledToolCount} tools, ${allResources.length} resources, ${allPrompts.length} prompts)`,
    );
  }

  getAdapter(key: string): DatabaseAdapter | undefined {
    return this.adapters.get(key);
  }

  getAdapters(): Map<string, DatabaseAdapter> {
    return this.adapters;
  }

  async start(): Promise<void> {
    if (this.started) {
      logger.warn("Server already started");
      return;
    }

    if (this.systemDbInitPromise) {
      await this.systemDbInitPromise;
    }

    logger.info("Starting MCP server...");

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

  private async startTransport(transport: TransportType): Promise<void> {
    switch (transport) {
      case "stdio":
        await this.startStdioTransport();
        break;
      case "http":
      case "sse": {
        const { createHttpTransport } = await import("../../transports/http/index.js");
        const port = this.config.port ?? 3000;

        const httpTransport = createHttpTransport(
          {
            port,
            host: this.config.host ?? "localhost",
            corsOrigins: ["*"],
            ...(this.config.authToken ? { authToken: this.config.authToken } : {}),
            stateless: this.config.stateless ?? false,
            trustProxy: this.config.trustProxy ?? false,
            ...(this.config.metricsExport !== undefined ? { metricsExport: this.config.metricsExport } : {}),
            ...(this.config.oauth?.enabled
              ? {
                  resourceServer: createOAuthResourceServer(this.config),
                  tokenValidator: createTokenValidator(this.config),
                }
              : {}),
          },
          async (mcpTransport: Transport) => {
            logger.info("New client connection");
            const server = this.server;
            if (server.isConnected()) {
              await server.close();
            }
            await server.connect(mcpTransport);

            mcpLogger.setConnected(true);
            mcpLogger.info("MySQL MCP server ready", {
              transport: this.config.transport,
            });
          },
        );

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
        throw new McpError(ErrorCode.InvalidRequest, `Unknown transport: ${String(transport)}`);
    }
  }

  private async startStdioTransport(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    logger.info("Stopping MCP server...");
    mcpLogger.setConnected(false);

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

  getConfig(): McpServerConfig {
    return { ...this.config };
  }

  getToolFilter(): ToolFilterConfig {
    return this.toolFilter;
  }

  isRunning(): boolean {
    return this.started;
  }

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

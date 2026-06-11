/**
 * mysql-mcp - Database Adapter Interface
 *
 * Abstract base class that all database adapters must implement.
 * Provides a consistent interface for database operations.
 */

import { EventEmitter } from "node:events";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  DatabaseType,
  DatabaseConfig,
  QueryResult,
  SchemaInfo,
  TableInfo,
  HealthStatus,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
  RequestContext,
  ToolGroup,
} from "../../types/index.js";
import type { AuditInterceptor } from "../../audit/interceptor.js";
import type { BackupManager } from "../../audit/backup-manager/index.js";
import type { AuditLogger } from "../../audit/logger.js";
import { validateSqlSafety } from "./validation.js";
import {
  registerTools,
  registerTool,
  registerResources,
  registerResource,
  registerPrompts,
  registerPrompt,
} from "./registration.js";

/**
 * Abstract base class for database adapters
 */
export abstract class DatabaseAdapter extends EventEmitter {
  /** Database type identifier */
  abstract readonly type: DatabaseType;

  /** Human-readable adapter name */
  abstract readonly name: string;

  /** Adapter version */
  abstract readonly version: string;

  /** Connection state */
  protected connected = false;

  // =========================================================================
  // Connection Lifecycle
  // =========================================================================

  /**
   * Connect to the database
   * @param config - Database connection configuration
   */
  abstract connect(config: DatabaseConfig): Promise<void>;

  /**
   * Disconnect from the database
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if connected to the database
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get health status of the database connection
   */
  abstract getHealth(): Promise<HealthStatus>;

  // =========================================================================
  // Query Execution
  // =========================================================================

  /**
   * Execute a read-only query (SELECT)
   * @param sql - SQL query string
   * @param params - Query parameters for prepared statements
   */
  abstract executeReadQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult>;

  /**
   * Execute a write query (INSERT, UPDATE, DELETE)
   * @param sql - SQL query string
   * @param params - Query parameters for prepared statements
   */
  abstract executeWriteQuery(
    sql: string,
    params?: unknown[],
  ): Promise<QueryResult>;

  /**
   * Execute any query (for admin operations)
   * @param sql - SQL query string
   * @param params - Query parameters for prepared statements
   */
  abstract executeQuery(sql: string, params?: unknown[]): Promise<QueryResult>;

  // =========================================================================
  // Schema Operations
  // =========================================================================

  /**
   * Get full database schema information
   */
  abstract getSchema(): Promise<SchemaInfo>;

  /**
   * List all tables in the database
   */
  abstract listTables(): Promise<TableInfo[]>;

  /**
   * Describe a specific table's structure
   * @param tableName - Name of the table
   */
  abstract describeTable(tableName: string): Promise<TableInfo>;

  /**
   * List available schemas/databases
   */
  abstract listSchemas(): Promise<string[]>;

  // =========================================================================
  // Capabilities
  // =========================================================================

  /**
   * Get adapter capabilities
   */
  abstract getCapabilities(): AdapterCapabilities;

  /**
   * Get supported tool groups for this adapter
   */
  abstract getSupportedToolGroups(): ToolGroup[];

  // =========================================================================
  // MCP Registration
  // =========================================================================

  /**
   * Get all tool definitions for this adapter
   */
  abstract getToolDefinitions(): ToolDefinition[];

  /**
   * Get all resource definitions for this adapter
   */
  abstract getResourceDefinitions(): ResourceDefinition[];

  /**
   * Get all prompt definitions for this adapter
   */
  abstract getPromptDefinitions(): PromptDefinition[];

  // =========================================================================
  // Audit Subsystem
  // =========================================================================

  protected auditLogger: AuditLogger | null = null;
  protected auditInterceptor: AuditInterceptor | null = null;
  protected backupManager: BackupManager | null = null;
  protected allowedIoRoots: string[] = [];

  /**
   * Inject the allowed IO roots for filesystem boundary sandboxing.
   */
  setAllowedIoRoots(roots: string[] | undefined): void {
    this.allowedIoRoots = roots ?? [];
  }

  /**
   * Get the allowed IO roots.
   */
  getAllowedIoRoots(): string[] {
    return this.allowedIoRoots;
  }

  /**
   * Inject the audit interceptor.
   */
  setAuditInterceptor(interceptor: AuditInterceptor): void {
    this.auditInterceptor = interceptor;
  }

  /**
   * Inject the backup manager for tools to use natively.
   */
  setBackupManager(manager: BackupManager): void {
    this.backupManager = manager;
  }

  /**
   * Inject the audit logger for tools to use natively.
   */
  setAuditLogger(logger: AuditLogger): void {
    this.auditLogger = logger;
  }

  /**
   * Get the audit logger.
   */
  getAuditLogger(): AuditLogger | null {
    return this.auditLogger;
  }

  /**
   * Get the audit interceptor (used by Code Mode to wrap inner tool calls).
   */
  getAuditInterceptor(): AuditInterceptor | null {
    return this.auditInterceptor;
  }

  /**
   * Register all enabled tools with the MCP server
   */
  registerTools(server: McpServer, enabledTools: Set<string>): void {
    registerTools(this, server, enabledTools);
  }

  /**
   * Register a single tool with the MCP server
   */
  protected registerTool(server: McpServer, tool: ToolDefinition): void {
    registerTool(this, server, tool);
  }

  /**
   * Register resources with the MCP server
   */
  registerResources(server: McpServer): void {
    registerResources(this, server);
  }

  /**
   * Register a single resource with the MCP server
   */
  protected registerResource(
    server: McpServer,
    resource: ResourceDefinition,
  ): void {
    registerResource(this, server, resource);
  }

  /**
   * Register prompts with the MCP server
   */
  registerPrompts(server: McpServer): void {
    registerPrompts(this, server);
  }

  /**
   * Register a single prompt with the MCP server
   */
  protected registerPrompt(server: McpServer, prompt: PromptDefinition): void {
    registerPrompt(this, server, prompt);
  }

  // =========================================================================
  // Query Validation
  // =========================================================================

  /**
   * Validate query for safety (SQL injection prevention)
   * @param sql - SQL query to validate
   * @param isReadOnly - Whether to enforce read-only restrictions
   */
  validateQuery(sql: string, isReadOnly: boolean): void {
    validateSqlSafety(sql, isReadOnly);
  }

  /**
   * Create a request context for tool execution
   */
  createContext(
    requestId?: string,
    server?: unknown,
    progressToken?: string | number,
  ): RequestContext {
    const context: RequestContext = {
      timestamp: new Date(),
      requestId: requestId ?? crypto.randomUUID(),
    };
    if (server !== undefined && server !== null) {
      context.server = server as McpServer;
    }
    if (progressToken !== undefined) {
      context.progressToken = progressToken;
    }
    return context;
  }

  /**
   * Get adapter info for logging/debugging
   */
  getInfo(): Record<string, unknown> {
    return {
      type: this.type,
      name: this.name,
      version: this.version,
      connected: this.connected,
      capabilities: this.getCapabilities(),
      toolGroups: this.getSupportedToolGroups(),
    };
  }
}

/**
 * mysql-mcp - Database Adapter Interface
 *
 * Abstract base class that all database adapters must implement.
 * Provides a consistent interface for database operations.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "../utils/logger.js";
import type { z } from "zod";
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
} from "../types/index.js";

/**
 * Dangerous SQL patterns for query validation (hoisted for performance)
 */
const DANGEROUS_QUERY_PATTERNS: RegExp[] = [
  /;\s*DROP\s+/i,
  /;\s*DELETE\s+/i,
  /;\s*TRUNCATE\s+/i,
  /;\s*INSERT\s+/i,
  /;\s*UPDATE\s+/i,
  /--\s*$/m, // SQL comment at end of line
];

/**
 * Write keywords for read-only query enforcement (hoisted for performance)
 */
const WRITE_KEYWORDS: string[] = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "REPLACE",
  "GRANT",
  "REVOKE",
];

/**
 * Abstract base class for database adapters
 */
export abstract class DatabaseAdapter {
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

  /**
   * Register tools with the MCP server
   * @param server - MCP server instance
   * @param enabledTools - Set of enabled tool names (from filtering)
   */
  registerTools(server: McpServer, enabledTools: Set<string>): void {
    const tools = this.getToolDefinitions();
    let registered = 0;

    for (const tool of tools) {
      if (enabledTools.has(tool.name)) {
        this.registerTool(server, tool);
        registered++;
      }
    }

    logger.info(
      `Registered ${registered}/${tools.length} tools from ${this.name}`,
    );
  }

  /**
   * Register a single tool with the MCP server
   */
  protected registerTool(server: McpServer, tool: ToolDefinition): void {
    // MCP SDK server.registerTool() registration
    // Build MCP tool options with annotations (MCP Spec 2025-11-25)
    const toolOptions: Record<string, unknown> = {
      description: tool.description,
    };

    // Add title if provided (human-readable display name)
    if (tool.title) {
      toolOptions["title"] = tool.title;
    }

    // Add behavioral annotations for AI clients
    if (tool.annotations) {
      toolOptions["annotations"] = tool.annotations;
    }

    // Create the tool options object with input schema
    // registerTool expects options as the second argument
    server.registerTool(
      tool.name,
      {
        ...toolOptions,
        inputSchema: tool.inputSchema as z.ZodType,
      },
      async (params: unknown) => {
        const context = this.createContext();
        const result = await tool.handler(params, context);
        return {
          content: [
            {
              type: "text" as const,
              text:
                typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }

  /**
   * Register resources with the MCP server
   */
  registerResources(server: McpServer): void {
    const resources = this.getResourceDefinitions();
    for (const resource of resources) {
      this.registerResource(server, resource);
    }
    logger.info(`Registered ${resources.length} resources from ${this.name}`);
  }

  /**
   * Register a single resource with the MCP server
   */
  protected registerResource(
    server: McpServer,
    resource: ResourceDefinition,
  ): void {
    // Build resource metadata with MCP 2025-11-25 enhancements
    const resourceMeta: Record<string, unknown> = {
      description: resource.description,
      mimeType: resource.mimeType ?? "application/json",
    };

    // Add title if provided
    if (resource.title) {
      resourceMeta["title"] = resource.title;
    }

    // Add annotations for AI clients (audience, priority, lastModified)
    if (resource.annotations) {
      resourceMeta["annotations"] = resource.annotations;
    }

    server.registerResource(
      resource.name,
      resource.uri,
      resourceMeta as { description?: string; mimeType?: string },
      async (uri: URL) => {
        const context = this.createContext();
        const result = await resource.handler(uri.toString(), context);
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: resource.mimeType ?? "application/json",
              text:
                typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2),
            },
          ],
        };
      },
    );
  }

  /**
   * Register prompts with the MCP server
   */
  registerPrompts(server: McpServer): void {
    const prompts = this.getPromptDefinitions();
    for (const prompt of prompts) {
      this.registerPrompt(server, prompt);
    }
    logger.info(`Registered ${prompts.length} prompts from ${this.name}`);
  }

  /**
   * Register a single prompt with the MCP server
   */
  protected registerPrompt(server: McpServer, prompt: PromptDefinition): void {
    // Do NOT pass argsSchema to the SDK. The SDK wraps any non-undefined
    // argsSchema into z.object({...}) and validates request.params.arguments
    // against it. When MCP clients call prompts/get without arguments,
    // request.params.arguments is undefined, and z.object().safeParse(undefined)
    // always fails — regardless of whether individual fields are .optional().
    // Required-arg enforcement is done in the handler wrapper below,
    // returning a helpful guide message instead of a Zod crash.
    const argsSchema = undefined;

    server.registerPrompt(
      prompt.name,
      {
        description: prompt.description,
        argsSchema,
      },
      async (providedArgs) => {
        const context = this.createContext();
        // Cast args to Record<string, string> for handler compatibility
        const args = (providedArgs ?? {}) as Record<string, string>;

        // Check for missing required arguments
        const requiredArgs = prompt.arguments?.filter((a) => a.required) ?? [];
        const missingArgs = requiredArgs.filter((a) => !args[a.name]);
        if (missingArgs.length > 0) {
          // Return a helpful guide listing expected arguments
          const argList = (prompt.arguments ?? [])
            .map(
              (a) =>
                `- **${a.name}**${a.required ? " (required)" : " (optional)"}: ${a.description}`,
            )
            .join("\n");
          return {
            messages: [
              {
                role: "user" as const,
                content: {
                  type: "text" as const,
                  text: `# ${prompt.name}\n\n${prompt.description}\n\n## Arguments\n\n${argList}\n\nPlease provide the required arguments to use this prompt.`,
                },
              },
            ],
          };
        }

        const result = await prompt.handler(args, context);
        return {
          messages: [
            {
              role: "user" as const,
              content: {
                type: "text" as const,
                text:
                  typeof result === "string"
                    ? result
                    : JSON.stringify(result, null, 2),
              },
            },
          ],
        };
      },
    );
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
    if (!sql || typeof sql !== "string") {
      throw new Error("Query must be a non-empty string");
    }

    const normalizedSql = sql.trim().toUpperCase();

    // Check for dangerous patterns
    for (const pattern of DANGEROUS_QUERY_PATTERNS) {
      if (pattern.test(sql)) {
        throw new Error("Query contains potentially dangerous patterns");
      }
    }

    // Enforce read-only for SELECT queries
    if (isReadOnly) {
      for (const keyword of WRITE_KEYWORDS) {
        if (normalizedSql.startsWith(keyword)) {
          throw new Error(
            `Read-only mode: ${keyword} statements are not allowed`,
          );
        }
      }
    }
  }

  /**
   * Create a request context for tool execution
   */
  createContext(requestId?: string): RequestContext {
    return {
      timestamp: new Date(),
      requestId: requestId ?? crypto.randomUUID(),
    };
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

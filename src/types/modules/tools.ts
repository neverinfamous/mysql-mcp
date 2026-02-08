/**
 * Tool, Resource, and Prompt Types
 *
 * Type definitions for MCP tools, resources, prompts, filtering,
 * and adapter capabilities.
 */

import type { OAuthScope } from "./oauth.js";
import type { RequestContext } from "./oauth.js";

/**
 * Tool group identifiers for MySQL
 */
export type ToolGroup =
  | "core" // Basic CRUD, schema operations
  | "json" // JSON operations (MySQL 5.7+)
  | "text" // Text processing (LIKE, REGEXP)
  | "fulltext" // FULLTEXT search
  | "performance" // EXPLAIN, query analysis
  | "optimization" // Index hints, recommendations
  | "admin" // OPTIMIZE, ANALYZE, FLUSH
  | "monitoring" // PROCESSLIST, status variables
  | "backup" // Export, import, mysqldump
  | "replication" // Master/slave, binlog
  | "partitioning" // Partition management
  | "transactions" // Transaction control
  | "router" // MySQL Router management
  | "proxysql" // ProxySQL management
  | "shell" // MySQL Shell utilities
  // New tool groups (v2.0.0)
  | "schema" // Schema object management
  | "events" // Event Scheduler
  | "sysschema" // sys schema diagnostics
  | "stats" // Statistical analysis
  | "spatial" // GIS/Spatial functions
  | "security" // Security and auditing
  | "cluster" // Group Replication & InnoDB Cluster
  | "roles" // Role management
  | "docstore"; // Document Store / X DevAPI

/**
 * Meta-group identifiers for common multi-group selections
 * These are shortcuts that expand to multiple ToolGroups
 */
export type MetaGroup =
  | "starter" // Recommended default (Core, JSON, Trans, Text) ~38 tools
  | "essential" // Minimal footprint (Core, Trans) ~15 tools
  | "dev-power" // Power Developer (Core, Schema, Perf, Stats, Fulltext) ~45 tools
  | "ai-data" // AI Data Analyst (Core, JSON, DocStore, Text, Fulltext) ~44 tools
  | "ai-spatial" // AI Spatial Analyst (Core, Spatial, Stats, Perf) ~43 tools
  | "dba-monitor" // DBA Monitoring (Core, Monitor, Perf, SysSchema, Opt) ~35 tools
  | "dba-manage" // DBA Management (Core, Admin, Backup, Repl, Parts, Events) ~33 tools
  | "dba-secure" // DBA Security (Core, Security, Roles) ~32 tools
  | "base-core" // Base: Core Operations ~48 tools
  | "base-advanced" // Base: Advanced Features ~39 tools
  | "ecosystem"; // External Tools + Cluster ~41 tools

/**
 * MySQL Router REST API configuration
 */
export interface RouterConfig {
  /** Router REST API base URL (e.g., https://localhost:8443) */
  url?: string;

  /** Router API username */
  username?: string;

  /** Router API password */
  password?: string;

  /** Skip TLS certificate verification (for self-signed certs) */
  insecure?: boolean;

  /** API version path (default: /api/20190715) */
  apiVersion?: string;
}

/**
 * MySQL Shell configuration
 */
export interface MySQLShellConfig {
  /** Path to mysqlsh binary (defaults to 'mysqlsh' from PATH) */
  binPath?: string;

  /** Timeout for shell commands in milliseconds (default: 300000 = 5 min) */
  timeout?: number;

  /** Working directory for dump/load operations */
  workDir?: string;
}

/**
 * Tool filter rule
 */
export interface ToolFilterRule {
  /** Rule type: include or exclude */
  type: "include" | "exclude";

  /** Target: group name or tool name */
  target: string;

  /** Whether target is a group (true) or individual tool (false) */
  isGroup: boolean;
}

/**
 * Parsed tool filter configuration
 */
export interface ToolFilterConfig {
  /** Original filter string */
  raw: string;

  /** Parsed rules in order */
  rules: ToolFilterRule[];

  /** Set of enabled tool names after applying rules */
  enabledTools: Set<string>;
}

/**
 * Capabilities supported by a database adapter
 */
export interface AdapterCapabilities {
  /** Supports JSON operations */
  json: boolean;

  /** Supports full-text search */
  fullTextSearch: boolean;

  /** Supports vector/embedding operations */
  vector: boolean;

  /** Supports geospatial operations */
  geospatial: boolean;

  /** Supports transactions */
  transactions: boolean;

  /** Supports prepared statements */
  preparedStatements: boolean;

  /** Supports connection pooling */
  connectionPooling: boolean;

  /** Supports partitioning */
  partitioning: boolean;

  /** Supports replication */
  replication: boolean;

  /** Additional capability flags */
  [key: string]: boolean;
}

/**
 * MCP Tool Annotations (MCP Spec 2025-11-25)
 *
 * Behavioral hints for AI clients to understand tool characteristics.
 * These are hints only - clients may ignore them.
 */
export interface ToolAnnotations {
  /**
   * Tool does not modify state (idempotent reads).
   * AI clients may auto-execute read-only tools without confirmation.
   */
  readOnlyHint?: boolean;

  /**
   * Tool may permanently delete/destroy data.
   * AI clients should require explicit confirmation.
   */
  destructiveHint?: boolean;

  /**
   * Repeated calls with same args produce same result.
   * Useful for caching or retry logic.
   */
  idempotentHint?: boolean;

  /**
   * Tool interacts with external services (network, APIs).
   * May have side effects outside the server.
   */
  openWorldHint?: boolean;
}

/**
 * Tool definition for registration
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tool group for filtering */
  group: ToolGroup;

  /** Zod schema for input validation */
  inputSchema: unknown;

  /** Required OAuth scopes */
  requiredScopes?: OAuthScope[];

  /** Tool handler function */
  handler: (params: unknown, context: RequestContext) => Promise<unknown>;

  // MCP 2025-11-25 Tool Enhancements

  /** Human-readable display title (defaults to name if not provided) */
  title?: string;

  /** JSON Schema for structured tool output (enables schema validation) */
  outputSchema?: unknown;

  /** Behavioral hints for AI clients */
  annotations?: ToolAnnotations;
}

/**
 * MCP Resource Annotations (MCP Spec 2025-11-25)
 *
 * Metadata hints for AI clients to understand resource characteristics.
 */
export interface ResourceAnnotations {
  /**
   * Intended audience for this resource.
   * 'user' = display to human, 'assistant' = use in AI context.
   */
  audience?: ("user" | "assistant")[];

  /**
   * Importance level from 0.0 (optional) to 1.0 (required).
   * AI clients may use this for context prioritization.
   */
  priority?: number;

  /**
   * ISO 8601 timestamp of when resource was last modified.
   * Useful for cache invalidation and freshness checks.
   */
  lastModified?: string;
}

/**
 * Resource definition for MCP
 */
export interface ResourceDefinition {
  /** Resource URI template */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** MIME type */
  mimeType?: string;

  /** Resource handler */
  handler: (uri: string, context: RequestContext) => Promise<unknown>;

  // MCP 2025-11-25 Resource Enhancements

  /** Human-readable display title */
  title?: string;

  /** Size in bytes (if known) */
  size?: number;

  /** Resource metadata annotations */
  annotations?: ResourceAnnotations;
}

/**
 * Prompt definition for MCP
 */
export interface PromptDefinition {
  /** Prompt name */
  name: string;

  /** Description */
  description: string;

  /** Argument definitions */
  arguments?: {
    name: string;
    description: string;
    required?: boolean;
  }[];

  /** Prompt handler */
  handler: (
    args: Record<string, string>,
    context: RequestContext,
  ) => Promise<unknown>;
}

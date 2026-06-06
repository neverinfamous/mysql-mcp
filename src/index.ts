/**
 * mysql-mcp - Public API
 *
 * Exports the main components for programmatic use.
 */

// Server
export {
  McpServer,
  createServer,
  DEFAULT_CONFIG,
  parseMySQLConnectionString,
} from "./server/mcp-server.js";

// Adapters
export { DatabaseAdapter } from "./adapters/database-adapter.js";
export { MySQLAdapter } from "./adapters/mysql/mysql-adapter.js";

// Pool
export { ConnectionPool } from "./pool/connection-pool.js";
export type { ConnectionPoolConfig } from "./pool/connection-pool.js";

// Filtering
export {
  TOOL_GROUPS,
  getAllToolNames,
  getToolGroup,
  parseToolFilter,
  isToolEnabled,
  filterTools,
  getToolFilterFromEnv,
  calculateTokenSavings,
  getFilterSummary,
  getToolGroupInfo,
  clearToolFilterCaches,
} from "./filtering/tool-filter.js";

// Types
export type {
  DatabaseType,
  DatabaseConfig,
  MySQLOptions,
  PoolConfig,
  PoolStats,
  HealthStatus,
  QueryResult,
  ColumnInfo,
  FieldInfo,
  TableInfo,
  SchemaInfo,
  IndexInfo,
  ConstraintInfo,
  RoutineInfo,
  TriggerInfo,
  TransportType,
  McpServerConfig,
  OAuthConfig,
  OAuthScope,
  TokenClaims,
  RequestContext,
  ToolGroup,
  ToolFilterRule,
  ToolFilterConfig,
  AdapterCapabilities,
  ToolDefinition,
  ResourceDefinition,
  PromptDefinition,
} from "./types/index.js";

// Errors
export {
  MySQLMcpError,
  ConnectionError,
  PoolError,
  QueryError,
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  TransactionError,
} from "./types/index.js";

// Logger
export { logger } from "./utils/logger.js";

// Version
export { VERSION } from "./version.js";

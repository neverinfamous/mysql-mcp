/**
 * mysql-mcp - MySQL Adapter Mock
 *
 * Provides mock implementation of MySQLAdapter for testing
 * tools, resources, and prompts without database dependency.
 */

import { vi } from "vitest";
import type { MySQLAdapter } from "../../adapters/mysql/MySQLAdapter.js";
import type {
  QueryResult,
  TableInfo,
  IndexInfo,
  SchemaInfo,
  HealthStatus,
  ColumnInfo,
} from "../../types/index.js";

/**
 * Create a mock query result
 */
export function createMockQueryResult(
  rows: Record<string, unknown>[] = [],
  affectedRows = 0,
): QueryResult {
  return {
    rows,
    rowsAffected: affectedRows,
    executionTimeMs: 5,
  };
}

/**
 * Create a mock column info
 */
export function createMockColumnInfo(
  name: string,
  type: string,
  nullable = true,
  primaryKey = false,
): ColumnInfo {
  return {
    name,
    type,
    nullable,
    primaryKey,
  };
}

/**
 * Create a mock table info
 */
export function createMockTableInfo(name: string, rowCount = 100): TableInfo {
  return {
    name,
    type: "table",
    columns: [
      createMockColumnInfo("id", "int", false, true),
      createMockColumnInfo("name", "varchar(255)", true, false),
      createMockColumnInfo("created_at", "datetime", false, false),
    ],
    rowCount,
    engine: "InnoDB",
    collation: "utf8mb4_unicode_ci",
  };
}

/**
 * Create mock index info
 */
export function createMockIndexInfo(
  tableName: string,
  indexName: string,
): IndexInfo {
  return {
    name: indexName,
    tableName,
    columns: ["id"],
    unique: indexName === "PRIMARY",
    type: "BTREE",
  };
}

/**
 * Create mock schema info
 */
export function createMockSchemaInfo(): SchemaInfo {
  return {
    tables: [createMockTableInfo("users"), createMockTableInfo("products")],
    views: [],
    indexes: [createMockIndexInfo("users", "PRIMARY")],
  };
}

/**
 * Create mock health status
 */
export function createMockHealthStatus(connected = true): HealthStatus {
  return {
    connected,
    latencyMs: 5,
    version: "8.0.35",
    poolStats: {
      total: 10,
      active: 2,
      idle: 8,
      waiting: 0,
      totalQueries: 100,
    },
  };
}

/**
 * Create a mock MySQLAdapter
 */
export function createMockMySQLAdapter(): Partial<MySQLAdapter> & {
  executeQuery: ReturnType<typeof vi.fn>;
  executeReadQuery: ReturnType<typeof vi.fn>;
  executeWriteQuery: ReturnType<typeof vi.fn>;
  rawQuery: ReturnType<typeof vi.fn>;
  getTableIndexes: ReturnType<typeof vi.fn>;
  describeTable: ReturnType<typeof vi.fn>;
  listTables: ReturnType<typeof vi.fn>;
  getSchema: ReturnType<typeof vi.fn>;
} {
  const mockQueryResult = createMockQueryResult([{ id: 1, name: "test" }]);

  return {
    type: "mysql" as const,
    name: "MySQL Adapter",
    version: "0.1.0",

    // Connection methods
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getHealth: vi.fn().mockResolvedValue(createMockHealthStatus()),
    isConnected: vi.fn().mockReturnValue(true),

    // Query execution
    executeQuery: vi.fn().mockResolvedValue(mockQueryResult),
    executeReadQuery: vi.fn().mockResolvedValue(mockQueryResult),
    executeWriteQuery: vi.fn().mockResolvedValue(mockQueryResult),
    rawQuery: vi.fn().mockResolvedValue(mockQueryResult),

    // Transaction methods
    beginTransaction: vi.fn().mockResolvedValue("txn-123"),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    getTransactionConnection: vi.fn().mockReturnValue(undefined),

    // Schema methods
    getSchema: vi.fn().mockResolvedValue(createMockSchemaInfo()),
    listTables: vi.fn().mockResolvedValue([createMockTableInfo("users")]),
    describeTable: vi.fn().mockResolvedValue(createMockTableInfo("users")),
    listSchemas: vi.fn().mockResolvedValue(["testdb", "information_schema"]),
    getTableIndexes: vi
      .fn()
      .mockResolvedValue([createMockIndexInfo("users", "PRIMARY")]),

    // Capabilities
    getCapabilities: vi.fn().mockReturnValue({
      json: true,
      fullTextSearch: true,
      vector: false,
      geospatial: true,
      transactions: true,
      preparedStatements: true,
      connectionPooling: true,
      partitioning: true,
      replication: true,
    }),
    getSupportedToolGroups: vi
      .fn()
      .mockReturnValue([
        "core",
        "transactions",
        "json",
        "text",
        "fulltext",
        "performance",
        "optimization",
        "admin",
        "monitoring",
        "backup",
      ]),

    // Definition getters
    getToolDefinitions: vi.fn().mockReturnValue([]),
    getResourceDefinitions: vi.fn().mockReturnValue([]),
    getPromptDefinitions: vi.fn().mockReturnValue([]),

    // Registration methods (used by McpServer)
    registerTools: vi.fn(),
    registerResources: vi.fn(),
    registerPrompts: vi.fn(),

    // Pool access
    getPool: vi.fn().mockReturnValue(null),
  };
}

/**
 * Create a mock RequestContext for handler testing
 */
export function createMockRequestContext(): {
  timestamp: Date;
  requestId: string;
} {
  return {
    timestamp: new Date(),
    requestId: "test-request-" + Math.random().toString(36).slice(2, 9),
  };
}

/**
 * Helper to configure mock adapter response for specific queries
 */
export function configureMockAdapterQuery(
  adapter: ReturnType<typeof createMockMySQLAdapter>,
  pattern: string,
  result: QueryResult,
): void {
  const originalImpl = adapter.executeQuery.getMockImplementation() as
    | ((sql: string) => Promise<QueryResult>)
    | undefined;

  adapter.executeQuery.mockImplementation((sql: string) => {
    if (sql.includes(pattern)) {
      return Promise.resolve(result);
    }
    return originalImpl?.(sql) ?? Promise.resolve(createMockQueryResult());
  });
}

/**
 * Create a mock MySQLAdapter that returns empty results
 */
export function createMockMySQLAdapterEmpty(): ReturnType<
  typeof createMockMySQLAdapter
> {
  const adapter = createMockMySQLAdapter();
  const emptyResult = createMockQueryResult([]);

  adapter.executeQuery.mockResolvedValue(emptyResult);
  adapter.executeReadQuery.mockResolvedValue(emptyResult);
  adapter.executeWriteQuery.mockResolvedValue({
    rows: [],
    rowsAffected: 0,
    executionTimeMs: 1,
  });
  adapter.rawQuery.mockResolvedValue(emptyResult);

  return adapter;
}

/**
 * Create a mock MySQLAdapter that throws on query execution
 */
export function createMockMySQLAdapterWithError(
  errorMessage = "Database connection failed",
): ReturnType<typeof createMockMySQLAdapter> {
  const adapter = createMockMySQLAdapter();
  const dbError = new Error(errorMessage);

  adapter.executeQuery.mockRejectedValue(dbError);
  adapter.executeReadQuery.mockRejectedValue(dbError);
  adapter.executeWriteQuery.mockRejectedValue(dbError);
  adapter.rawQuery.mockRejectedValue(dbError);
  (adapter.getHealth as ReturnType<typeof vi.fn>).mockResolvedValue(
    createMockHealthStatus(false),
  );

  return adapter;
}

/**
 * Create a mock adapter for transaction testing with a mock connection
 */
export function createMockMySQLAdapterWithTransaction(): ReturnType<
  typeof createMockMySQLAdapter
> & {
  mockConnection: {
    query: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
    release: ReturnType<typeof vi.fn>;
  };
} {
  const adapter = createMockMySQLAdapter();

  const mockConnection = {
    query: vi.fn().mockResolvedValue([[], []]),
    execute: vi.fn().mockResolvedValue([[], []]),
    release: vi.fn(),
  };

  (
    adapter.getTransactionConnection as ReturnType<typeof vi.fn>
  ).mockReturnValue(mockConnection);

  return { ...adapter, mockConnection };
}

/**
 * Type alias for the mock adapter return type
 */
export type MockMySQLAdapter = ReturnType<typeof createMockMySQLAdapter>;

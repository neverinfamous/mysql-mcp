import { vi, type Mock } from "vitest";
import { MySQLAdapter } from "../../adapters/mysql/mysql-adapter/index.js";
import type {
  QueryResult,
  TableInfo,
  IndexInfo,
  SchemaInfo,
  HealthStatus,
  ColumnInfo,
  DatabaseConfig,
} from "../../types/index.js";

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

export function createMockColumnInfo(
  name: string,
  type: string,
  nullable = true,
  primaryKey = false,
): ColumnInfo {
  return { name, type, nullable, primaryKey };
}

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

export function createMockSchemaInfo(): SchemaInfo {
  return {
    tables: [createMockTableInfo("users"), createMockTableInfo("products")],
    views: [],
    indexes: [createMockIndexInfo("users", "PRIMARY")],
  };
}

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

export class MockMySQLAdapter extends MySQLAdapter {
  override connect: Mock<(config: DatabaseConfig) => Promise<void>> = vi.fn().mockResolvedValue(undefined);
  override disconnect: Mock<() => Promise<void>> = vi.fn().mockResolvedValue(undefined);
  override getHealth: Mock<() => Promise<HealthStatus>> = vi.fn().mockResolvedValue(createMockHealthStatus());
  override isConnected: Mock<() => boolean> = vi.fn().mockReturnValue(true);

  override executeQuery: Mock<(sql: string, params?: unknown[], txId?: string) => Promise<QueryResult>> = vi.fn().mockResolvedValue(createMockQueryResult([{ id: 1, name: "test" }]));
  override executeReadQuery: Mock<(sql: string, params?: unknown[]) => Promise<QueryResult>> = vi.fn().mockResolvedValue(createMockQueryResult([{ id: 1, name: "test" }]));
  override executeWriteQuery: Mock<(sql: string, params?: unknown[], txId?: string) => Promise<QueryResult>> = vi.fn().mockResolvedValue(createMockQueryResult([{ id: 1, name: "test" }]));
  override rawQuery: Mock<(sql: string) => Promise<QueryResult>> = vi.fn().mockResolvedValue(createMockQueryResult([{ id: 1, name: "test" }]));

  override beginTransaction: Mock<(txId?: string) => Promise<string>> = vi.fn().mockResolvedValue("txn-123");
  override commitTransaction: Mock<(txId: string) => Promise<void>> = vi.fn().mockResolvedValue(undefined);
  override rollbackTransaction: Mock<(txId: string) => Promise<void>> = vi.fn().mockResolvedValue(undefined);
  override getTransactionConnection: Mock<(txId: string) => any> = vi.fn().mockReturnValue(undefined);

  override getSchema: Mock<() => Promise<SchemaInfo>> = vi.fn().mockResolvedValue(createMockSchemaInfo());
  override listTables: Mock<(schema?: string) => Promise<TableInfo[]>> = vi.fn().mockResolvedValue([createMockTableInfo("users")]);
  override describeTable: Mock<(name: string) => Promise<TableInfo>> = vi.fn().mockResolvedValue(createMockTableInfo("users"));
  override listSchemas: Mock<() => Promise<string[]>> = vi.fn().mockResolvedValue(["testdb", "information_schema"]);
  override getTableIndexes: Mock<(name: string) => Promise<IndexInfo[]>> = vi.fn().mockResolvedValue([createMockIndexInfo("users", "PRIMARY")]);

  override getCapabilities: Mock<() => any> = vi.fn().mockReturnValue({
    json: true,
    fullTextSearch: true,
    vector: false,
    geospatial: true,
    transactions: true,
    preparedStatements: true,
    connectionPooling: true,
    partitioning: true,
    replication: true,
  });
  
  override getSupportedToolGroups: Mock<() => any> = vi.fn().mockReturnValue([
    "core", "transactions", "json", "text", "fulltext", "performance",
    "optimization", "admin", "monitoring", "backup"
  ]);

  override getToolDefinitions: Mock<() => any[]> = vi.fn().mockReturnValue([]);
  override getResourceDefinitions: Mock<() => any[]> = vi.fn().mockReturnValue([]);
  override getPromptDefinitions: Mock<() => any[]> = vi.fn().mockReturnValue([]);

  override registerTools: Mock<(server: any, adapter: any) => void> = vi.fn();
  override registerResources: Mock<(server: any) => void> = vi.fn();
  override registerPrompts: Mock<(server: any) => void> = vi.fn();

  override setAllowedIoRoots: Mock<(roots: string[] | undefined) => void> = vi.fn();
  override getAllowedIoRoots: Mock<() => string[]> = vi.fn().mockReturnValue(["/tmp", "C:\\temp", "/backup", "/o", "/in"]);

  override clearSchemaCache: Mock<() => void> = vi.fn();

  override getPool: Mock<() => any> = vi.fn().mockImplementation(() => ({
    getConnection: vi.fn().mockResolvedValue({
      query: vi.fn().mockImplementation(async (...args: unknown[]) => {
        const sql = typeof args[0] === "string" ? args[0] : (args[0] && typeof args[0] === "object" && "sql" in args[0] ? String(Reflect.get(args[0], "sql")) : "");
        if (sql.trim().toUpperCase().startsWith("SET")) {
          const res = await this.executeQuery(sql);
          return [res.rows ?? [], []];
        }
        const res = await this.executeReadQuery(sql);
        return [res.rows ?? [], []];
      }),
      execute: vi.fn().mockImplementation(async (...args: unknown[]) => {
        const sql = typeof args[0] === "string" ? args[0] : (args[0] && typeof args[0] === "object" && "sql" in args[0] ? String(Reflect.get(args[0], "sql")) : "");
        const res = await this.executeReadQuery(sql);
        return [res.rows ?? [], []];
      }),
      release: vi.fn(),
    }),
    releaseConnection: vi.fn(),
    getStats: vi.fn().mockReturnValue(createMockHealthStatus().poolStats),
  }));
}

export function createMockMySQLAdapter(): MockMySQLAdapter {
  return new MockMySQLAdapter();
}

export function createMockRequestContext(): { timestamp: Date; requestId: string } {
  return { timestamp: new Date(), requestId: "test-request-" + Math.random().toString(36).slice(2, 9) };
}

export function configureMockAdapterQuery(
  adapter: MockMySQLAdapter,
  pattern: string,
  result: QueryResult,
): void {
  const originalImpl = adapter.executeQuery.getMockImplementation();
  adapter.executeQuery.mockImplementation((sql: string, params?: unknown[], txId?: string) => {
    if (sql.includes(pattern)) {
      return Promise.resolve(result);
    }
    return originalImpl ? originalImpl(sql, params, txId) : Promise.resolve(createMockQueryResult([]));
  });
}

export function createMockMySQLAdapterEmpty(): MockMySQLAdapter {
  const adapter = createMockMySQLAdapter();
  const emptyResult = createMockQueryResult([]);
  adapter.executeQuery.mockResolvedValue(emptyResult);
  adapter.executeReadQuery.mockResolvedValue(emptyResult);
  adapter.executeWriteQuery.mockResolvedValue({ rows: [], rowsAffected: 0, executionTimeMs: 1 });
  adapter.rawQuery.mockResolvedValue(emptyResult);
  return adapter;
}

export function createMockMySQLAdapterWithError(
  errorMessage = "Database connection failed",
): MockMySQLAdapter {
  const adapter = createMockMySQLAdapter();
  const dbError = new Error(errorMessage);
  adapter.executeQuery.mockRejectedValue(dbError);
  adapter.executeReadQuery.mockRejectedValue(dbError);
  adapter.executeWriteQuery.mockRejectedValue(dbError);
  adapter.rawQuery.mockRejectedValue(dbError);
  adapter.getHealth.mockResolvedValue(createMockHealthStatus(false));
  return adapter;
}

export function createMockMySQLAdapterWithTransaction(): MockMySQLAdapter & {
  mockConnection: { query: Mock; execute: Mock; release: Mock };
} {
  const adapter = createMockMySQLAdapter();
  const mockConnection = {
    query: vi.fn().mockResolvedValue([[], []]),
    execute: vi.fn().mockResolvedValue([[], []]),
    release: vi.fn(),
  };
  adapter.getTransactionConnection.mockReturnValue(mockConnection);
  return Object.assign(adapter, { mockConnection });
}

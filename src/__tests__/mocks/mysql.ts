/**
 * mysql-mcp - MySQL Connection Mock
 *
 * Provides mock implementations of mysql2 connection pool
 * for unit testing without database dependency.
 */

import { vi } from "vitest";
import type {
  PoolConnection,
  FieldPacket,
  ResultSetHeader,
  Pool,
} from "mysql2/promise";

/**
 * Mock field packet for query results
 */
export function createMockFieldPacket(name: string, type = 253): FieldPacket {
  return {
    catalog: "def",
    db: "testdb",
    table: "test_table",
    orgTable: "test_table",
    name,
    orgName: name,
    charsetNr: 33,
    length: 255,
    type,
    flags: 0,
    decimals: 0,
  } as FieldPacket;
}

/**
 * Mock result set header for write operations
 */
export function createMockResultSetHeader(
  affectedRows = 1,
  insertId = 0,
): ResultSetHeader {
  return {
    constructor: { name: "ResultSetHeader" },
    fieldCount: 0,
    affectedRows,
    insertId,
    info: "",
    serverStatus: 2,
    warningStatus: 0,
    changedRows: 0,
  } as ResultSetHeader;
}

/**
 * Create a mock pool connection
 */
export function createMockPoolConnection(
  queryResult: unknown[] = [],
  executeResult: unknown[] = [],
): PoolConnection {
  const mockConnection = {
    query: vi.fn().mockResolvedValue([queryResult, []]),
    execute: vi.fn().mockResolvedValue([executeResult, []]),
    release: vi.fn(),
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue(undefined),
    end: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    connection: {
      serverVersion: "8.0.35",
    },
    threadId: 1,
  } as unknown as PoolConnection;

  return mockConnection;
}

/**
 * Create a mock connection pool
 */
export function createMockPool(
  queryResult: unknown[] = [],
  executeResult: unknown[] = [],
): Pool {
  const mockConnection = createMockPoolConnection(queryResult, executeResult);

  const mockPool = {
    getConnection: vi.fn().mockResolvedValue(mockConnection),
    query: vi.fn().mockResolvedValue([queryResult, []]),
    execute: vi.fn().mockResolvedValue([executeResult, []]),
    end: vi.fn().mockResolvedValue(undefined),
    pool: {
      _allConnections: { length: 10 },
      _freeConnections: { length: 5 },
      _connectionQueue: { length: 0 },
    },
  } as unknown as Pool;

  return mockPool;
}

/**
 * Mock mysql2/promise module
 */
export function mockMysql2Module(): {
  createPool: ReturnType<typeof vi.fn>;
  resetMock: () => void;
} {
  const mockPool = createMockPool();
  const createPool = vi.fn().mockReturnValue(mockPool);

  return {
    createPool,
    resetMock: () => {
      vi.clearAllMocks();
    },
  };
}

/**
 * Helper to set up mock query responses
 */
export function setupMockQueryResponse(
  pool: Pool,
  responses: Map<string, unknown[]>,
): void {
  const queryFn = pool.query as ReturnType<typeof vi.fn>;
  const executeFn = pool.execute as ReturnType<typeof vi.fn>;

  const mockImplementation = (
    sql: string,
  ): Promise<[unknown[], FieldPacket[]]> => {
    for (const [pattern, result] of responses) {
      if (sql.includes(pattern)) {
        return Promise.resolve([result, []]);
      }
    }
    return Promise.resolve([[], []]);
  };

  queryFn.mockImplementation(mockImplementation);
  executeFn.mockImplementation(mockImplementation);
}

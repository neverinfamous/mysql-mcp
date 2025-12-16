/**
 * mysql-mcp - Test Mocks
 * 
 * Centralized mock factories for testing. All tests should import
 * mocks from this module for consistency.
 */

// MySQL Adapter mocks
export {
    createMockQueryResult,
    createMockColumnInfo,
    createMockTableInfo,
    createMockIndexInfo,
    createMockSchemaInfo,
    createMockHealthStatus,
    createMockMySQLAdapter,
    createMockMySQLAdapterEmpty,
    createMockMySQLAdapterWithError,
    createMockMySQLAdapterWithTransaction,
    createMockRequestContext,
    configureMockAdapterQuery
} from './adapter.js';
export type { MockMySQLAdapter } from './adapter.js';

// MySQL connection and pool mocks
export {
    createMockFieldPacket,
    createMockResultSetHeader,
    createMockPoolConnection,
    createMockPool,
    mockMysql2Module,
    setupMockQueryResponse
} from './mysql.js';

// Re-export types for convenience
export type { QueryResult, TableInfo, IndexInfo, SchemaInfo, HealthStatus, ColumnInfo } from '../../types/index.js';

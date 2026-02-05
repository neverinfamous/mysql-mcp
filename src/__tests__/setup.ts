/**
 * mysql-mcp - Global Test Setup
 *
 * Common test utilities and setup for all test files.
 */

import { vi } from "vitest";

// Mock console to reduce noise in tests (optional - can be removed for debugging)
// vi.spyOn(console, 'log').mockImplementation(() => {});
// vi.spyOn(console, 'info').mockImplementation(() => {});
// vi.spyOn(console, 'warn').mockImplementation(() => {});

/**
 * Reset all mocks after each test
 */
export function setupTestEnvironment(): void {
  vi.clearAllMocks();
}

/**
 * Test database configuration for integration tests
 * Uses the Docker MySQL container when available
 */
export const TEST_DB_CONFIG = {
  host: "localhost",
  port: 3306,
  user: "root",
  password: "root",
  database: "testdb",
};

/**
 * Helper to create a mock query result
 */
export function createMockQueryResult<T>(
  rows: T[],
  affectedRows = 0,
): {
  rows: T[];
  fields: Array<{ name: string; type: number }>;
  affectedRows: number;
  insertId: number;
} {
  return {
    rows,
    fields: [],
    affectedRows,
    insertId: 0,
  };
}

/**
 * Helper to create mock field metadata
 */
export function createMockFields(
  names: string[],
): Array<{ name: string; type: number }> {
  return names.map((name) => ({ name, type: 253 })); // 253 = VARCHAR
}

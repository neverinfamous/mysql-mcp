import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMySQLAdapter, createMockQueryResult, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createLocksResource } from '../locks.js';

describe('Locks Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should return lock information including waits and statistics', async () => {
        // Mock data_lock_waits query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            {
                waiting_trx_id: '100',
                waiting_thread: 1,
                waiting_query: 'SELECT * FROM users FOR UPDATE',
                blocking_trx_id: '101',
                blocking_thread: 2,
                blocking_query: 'UPDATE users SET name = "test"',
                wait_seconds: 5
            }
        ]));

        // Mock Innodb_row_lock% status query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'Innodb_row_lock_current_waits', Value: '1' },
            { Variable_name: 'Innodb_row_lock_time', Value: '5000' }
        ]));

        const resource = createLocksResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://locks', mockContext) as any;

        expect(result.currentLockWaits).toBe(1);
        expect(result.lockWaits).toHaveLength(1);
        expect(result.lockWaits[0]).toHaveProperty('waiting_trx_id', '100');
        expect(result.lockStatistics).toHaveProperty('Innodb_row_lock_current_waits', '1');
    });

    it('should handle errors gracefully', async () => {
        mockAdapter.executeQuery.mockRejectedValue(new Error('Database error'));

        const resource = createLocksResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://locks', mockContext) as any;

        expect(result).toHaveProperty('error');
        expect(result.currentLockWaits).toBe(0);
        expect(result.lockWaits).toHaveLength(0);
    });

    it('should handle empty lock stats', async () => {
        // Mock data_lock_waits query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

        // Mock Innodb_row_lock% status query returning empty or malformed
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

        const resource = createLocksResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://locks', mockContext) as any;

        expect(result.currentLockWaits).toBe(0);
        expect(result.lockStatistics).toEqual({});
    });

    it('should handle non-string variable names gracefully', async () => {
        // Mock data_lock_waits query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

        // Mock Innodb_row_lock% status query with non-string name
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: null, Value: '123' },
            { Variable_name: 123, Value: '456' },
            { Variable_name: 'valid_var', Value: '789' }
        ]));

        const resource = createLocksResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://locks', mockContext) as any;

        expect(result.lockStatistics).toEqual({
            'valid_var': '789'
        });
    });
    it('should handle undefined rows from query results gracefully', async () => {
        // Mock data_lock_waits query returning valid result object but with undefined rows
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: undefined,
            rowsAffected: 0,
            executionTimeMs: 0
        });

        // Mock Innodb_row_lock% status query returning valid result but undefined rows
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: undefined,
            rowsAffected: 0,
            executionTimeMs: 0
        });

        const resource = createLocksResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://locks', mockContext) as any;

        expect(result.currentLockWaits).toBe(0);
        expect(result.lockWaits).toEqual([]);
        expect(result.lockStatistics).toEqual({});
    });
});

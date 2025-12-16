
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMySQLAdapter, createMockQueryResult, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import { createHealthResource } from '../health.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';

describe('Health Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should return default values when status variables are missing', async () => {
        // Empty status result
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));
        // Missing max_connections (default 151)
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

        const resource = createHealthResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://health', mockContext) as any;

        expect(result.status).toBe('healthy');
        expect(result.uptime_seconds).toBe(0);
        expect(result.connections.current).toBe(0);
        expect(result.connections.max_allowed).toBe(151); // Default
        expect(result.connections.usage_percent).toBe(0);
    });

    it('should handle zero buffer pool requests (avoid div by zero)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'Innodb_buffer_pool_read_requests', Value: '0' },
            { Variable_name: 'Innodb_buffer_pool_reads', Value: '0' }
        ]));
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ Value: '100' }]));

        const resource = createHealthResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://health', mockContext) as any;

        expect(result.performance.buffer_pool_hit_ratio).toBe(100);
    });

    it('should handle zero table lock waits (avoid div by zero)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'Table_locks_waited', Value: '0' },
            { Variable_name: 'Table_locks_immediate', Value: '0' }
        ]));
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ Value: '100' }]));

        const resource = createHealthResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://health', mockContext) as any;

        expect(result.performance.table_lock_contention_percent).toBe(0);
    });

    it('should calculate metrics correctly with values', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'Uptime', Value: '3600' },
            { Variable_name: 'Threads_connected', Value: '50' },
            { Variable_name: 'Innodb_buffer_pool_read_requests', Value: '100' },
            { Variable_name: 'Innodb_buffer_pool_reads', Value: '10' }, // 90% hit ratio
            { Variable_name: 'Table_locks_waited', Value: '20' },
            { Variable_name: 'Table_locks_immediate', Value: '80' } // 20% contention
        ]));
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ Value: '100' }])); // Max connections

        const resource = createHealthResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://health', mockContext) as any;

        expect(result.uptime_seconds).toBe(3600);
        expect(result.connections.usage_percent).toBe(50); // 50/100
        expect(result.performance.buffer_pool_hit_ratio).toBe(90);
        expect(result.performance.table_lock_contention_percent).toBe(20);
    });

    it('should include pool stats if available', async () => {
        mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

        const mockPool = {
            getStats: vi.fn().mockReturnValue({ total: 10, active: 5, idle: 5 })
        };
        (mockAdapter.getPool as any).mockReturnValue(mockPool);

        const resource = createHealthResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://health', mockContext) as any;

        expect(result.pool).toEqual({ total: 10, active: 5, idle: 5 });
    });
});

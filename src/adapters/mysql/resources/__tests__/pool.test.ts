
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPoolResource } from '../pool.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext } from '../../../../__tests__/mocks/index.js';

interface PoolResult {
    poolStats?: { total: number; active: number; idle: number };
    error?: string;
}

describe('Pool Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should return pool statistics when pool available', async () => {
        (mockAdapter.getPool as ReturnType<typeof vi.fn>).mockReturnValue({
            getStats: () => ({
                total: 10,
                active: 3,
                idle: 7,
                waiting: 0,
                totalQueries: 500
            })
        });

        const resource = createPoolResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://pool', mockContext) as PoolResult;

        expect(result).toHaveProperty('poolStats');
        expect(result.poolStats).toHaveProperty('total', 10);
        expect(result.poolStats).toHaveProperty('active', 3);
        expect(result.poolStats).toHaveProperty('idle', 7);
    });

    it('should handle missing pool gracefully', async () => {
        (mockAdapter.getPool as ReturnType<typeof vi.fn>).mockReturnValue(null);

        const resource = createPoolResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://pool', mockContext);

        expect(result).toHaveProperty('error');
    });
});

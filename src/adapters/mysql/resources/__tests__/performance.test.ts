
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPerformanceResource } from '../performance.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../__tests__/mocks/index.js';

describe('Performance Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should return performance metrics', async () => {
        // Mock status
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'Queries', Value: '100000' },
            { Variable_name: 'Slow_queries', Value: '50' },
            { Variable_name: 'Select_full_join', Value: '10' },
            { Variable_name: 'Created_tmp_tables', Value: '1000' },
            { Variable_name: 'Created_tmp_disk_tables', Value: '100' },
            { Variable_name: 'Handler_read_key', Value: '50000' },
            { Variable_name: 'Handler_read_rnd_next', Value: '10000' }
        ]));
        // Mock performance schema query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { query_pattern: 'SELECT * FROM users', execution_count: 100, total_time_ms: 500 }
        ]));

        const resource = createPerformanceResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://performance', mockContext) as { summary: { total_queries: number } };

        expect(result).toHaveProperty('summary');
        expect(result.summary).toHaveProperty('total_queries', 100000);
        expect(result.summary).toHaveProperty('slow_queries', 50);
        expect(result).toHaveProperty('sorts');
        expect(result).toHaveProperty('joins');
        expect(result).toHaveProperty('handler');
        expect(result).toHaveProperty('top_queries');
    });

    it('should handle missing performance schema', async () => {
        // Mock status success
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'Queries', Value: '500' }
        ]));

        // Mock performance schema failure
        mockAdapter.executeQuery.mockRejectedValueOnce(new Error('Table doesn\'t exist'));

        const resource = createPerformanceResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://performance', mockContext) as { summary: object, top_queries: unknown[] };

        expect(result.top_queries).toEqual([]);
        expect(result.summary).toHaveProperty('total_queries', 500);
    });
});

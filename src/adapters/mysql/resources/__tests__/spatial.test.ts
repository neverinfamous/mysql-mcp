
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMySQLAdapter, createMockQueryResult, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import { createSpatialResource } from '../spatial.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';

describe('Spatial Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should return spatial columns information', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { table_name: 'locations', column_name: 'geom', data_type: 'geometry' }
        ]));
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([])); // spatial indexes

        const resource = createSpatialResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://spatial', mockContext);

        expect(result).toBeDefined();
        // @ts-ignore
        expect(result.spatialColumns).toHaveLength(1);
        // @ts-ignore
        expect(result.spatialIndexCount).toBe(0);
    });

    it('should handle null query results', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult(null as any)); // Columns
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult(null as any)); // Indexes

        const resource = createSpatialResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://spatial', mockContext);

        expect(result).toEqual({
            spatialColumnCount: 0,
            spatialColumns: [],
            spatialIndexCount: 0,
            spatialIndexes: []
        });
    });
});

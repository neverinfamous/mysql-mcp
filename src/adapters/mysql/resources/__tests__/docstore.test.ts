
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createDocstoreResource } from '../docstore.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../__tests__/mocks/index.js';

describe('createDocstoreResource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let resource: ReturnType<typeof createDocstoreResource>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
        resource = createDocstoreResource(mockAdapter as unknown as MySQLAdapter);
    });

    it('should correctly separate handler logic', () => {
        expect(resource.name).toBe('Document Store Collections');
        expect(typeof resource.handler).toBe('function');
    });

    it('should return correct info when X Plugin is active and collections exist', async () => {
        // Mock X Plugin status query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { PLUGIN_STATUS: 'ACTIVE' }
        ]));

        // Mock Collections query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { collection_name: 'users', row_count: 100, size_bytes: 1024 },
            { collection_name: 'settings', row_count: 5, size_bytes: 512 }
        ]));

        const result = await resource.handler(resource.uri, mockContext);

        expect(result).toEqual({
            xPluginEnabled: true,
            collectionCount: 2,
            collections: [
                { collection_name: 'users', row_count: 100, size_bytes: 1024 },
                { collection_name: 'settings', row_count: 5, size_bytes: 512 }
            ],
            note: 'X Plugin is active - X Protocol available on port 33060'
        });

        expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
    });

    it('should return correct info when X Plugin is INACTIVE', async () => {
        // Mock X Plugin status query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { PLUGIN_STATUS: 'INACTIVE' }
        ]));

        // Mock Collections query (empty)
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

        const result = await resource.handler(resource.uri, mockContext);

        expect(result).toEqual({
            xPluginEnabled: false,
            collectionCount: 0,
            collections: [],
            note: 'X Plugin not active - document store limited to SQL access'
        });
    });

    it('should handle undefined rows gracefully', async () => {
        // Mock X Plugin status query
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { PLUGIN_STATUS: 'ACTIVE' }
        ]));

        // Mock Collections query returning no rows property (e.g. some drivers might not return it)
        mockAdapter.executeQuery.mockResolvedValueOnce({} as any);

        const result = await resource.handler(resource.uri, mockContext) as any;

        expect(result.collectionCount).toBe(0);
        expect(result.collections).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
        mockAdapter.executeQuery.mockRejectedValue(new Error('Database unavailable'));

        const result = await resource.handler(resource.uri, mockContext);

        expect(result).toEqual({
            xPluginEnabled: false,
            collectionCount: 0,
            collections: [],
            error: 'Unable to retrieve document store information'
        });
    });
});

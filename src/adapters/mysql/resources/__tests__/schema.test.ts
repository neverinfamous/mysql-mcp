
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSchemaResource } from '../schema.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext } from '../../../../__tests__/mocks/index.js';

describe('Schema Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should call getSchema adapter method', async () => {
        const resource = createSchemaResource(mockAdapter as unknown as MySQLAdapter);
        await resource.handler('mysql://schema', mockContext);

        expect(mockAdapter.getSchema).toHaveBeenCalled();
    });

    it('should return schema information', async () => {
        const resource = createSchemaResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://schema', mockContext);

        expect(result).toHaveProperty('tables');
    });
});

/**
 * mysql-mcp - Variables Resource Unit Tests
 * 
 * Tests for variables resource handler execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockMySQLAdapter, createMockQueryResult, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createVariablesResource } from '../variables.js';

describe('Variables Resource', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    it('should return all global variables', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
            { Variable_name: 'max_connections', Value: '151' },
            { Variable_name: 'innodb_buffer_pool_size', Value: '134217728' }
        ]));

        const resource = createVariablesResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://variables', mockContext) as { variables: Record<string, string> };

        expect(result.variables).toEqual({
            max_connections: '151',
            innodb_buffer_pool_size: '134217728'
        });
        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SHOW GLOBAL VARIABLES');
    });

    it('should handle empty result set', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

        const resource = createVariablesResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://variables', mockContext) as { variables: Record<string, string> };

        expect(result.variables).toEqual({});
    });

    it('should handle missing rows property in result', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            columns: [],
            rowsAffected: 0,
            insertId: undefined,
            start_time: 0,
            executionTimeMs: 0
        });

        const resource = createVariablesResource(mockAdapter as unknown as MySQLAdapter);
        const result = await resource.handler('mysql://variables', mockContext) as { variables: Record<string, string> };

        expect(result.variables).toEqual({});
    });

    it('should handle database errors', async () => {
        mockAdapter.executeQuery.mockRejectedValueOnce(new Error('Connection failed'));

        const resource = createVariablesResource(mockAdapter as unknown as MySQLAdapter);
        
        await expect(resource.handler('mysql://variables', mockContext))
            .rejects.toThrow('Connection failed');
    });
});

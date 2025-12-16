/**
 * mysql-mcp - JSON Helper Tools Unit Tests
 * 
 * Comprehensive tests for helpers.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createJsonGetTool,
    createJsonUpdateTool,
    createJsonSearchTool,
    createJsonValidateTool
} from '../helpers.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../../__tests__/mocks/index.js';

describe('JSON Helper Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    describe('createJsonGetTool', () => {
        it('should get JSON value by ID', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ value: '{"a":1}' }]));

            const tool = createJsonGetTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.a',
                id: 1
            }, mockContext) as { value: any };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_EXTRACT');
            expect(call).toContain('WHERE `id` = ?');
            expect(result.value).toBe('{"a":1}');
        });
    });

    describe('createJsonUpdateTool', () => {
        it('should update JSON value by ID', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1, insertId: 0 });

            const tool = createJsonUpdateTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.a',
                value: 2,
                id: 1
            }, mockContext) as { success: boolean };

            expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });
    });

    describe('createJsonSearchTool', () => {
        it('should search JSON by value', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ id: 1, match_path: '$[0]' }]));

            const tool = createJsonSearchTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                searchValue: 'test'
            }, mockContext);

            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_SEARCH');
        });
    });

    describe('createJsonValidateTool', () => {
        it('should validate JSON string', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ is_valid: 1 }]));

            const tool = createJsonValidateTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                value: '{"a":1}'
            }, mockContext) as { valid: boolean };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            expect(result.valid).toBe(true);
        });
    });
});

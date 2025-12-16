/**
 * mysql-mcp - JSON Core Tools Unit Tests
 * 
 * Comprehensive tests for core.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createJsonExtractTool,
    createJsonSetTool,
    createJsonInsertTool,
    createJsonReplaceTool,
    createJsonRemoveTool,
    createJsonContainsTool,
    createJsonKeysTool,
    createJsonArrayAppendTool
} from '../core.js';
import type { MySQLAdapter } from '../../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../../__tests__/mocks/index.js';

describe('JSON Core Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    describe('createJsonExtractTool', () => {
        it('should extract JSON value', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ extracted_value: 'value' }]));

            const tool = createJsonExtractTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.key'
            }, mockContext) as { rows: unknown[] };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_EXTRACT(`json_col`, ?)');
            expect(result.rows).toHaveLength(1);
        });
    });

    describe('createJsonSetTool', () => {
        it('should set JSON value', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({
                rowsAffected: 1,
                insertId: 0
            });

            const tool = createJsonSetTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.key',
                value: '"new_value"',
                where: 'id = 1'
            }, mockContext) as { rowsAffected: number };

            expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
            const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_SET');
            expect(result.rowsAffected).toBe(1);
        });

        it('should stringify object value', async () => {
            const tool = createJsonSetTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.key',
                value: { foo: 'bar' },
                where: 'id = 1'
            }, mockContext);

            const args = mockAdapter.executeWriteQuery.mock.calls[0][1] as unknown[];
            expect(args[1]).toBe('{"foo":"bar"}');
        });
    });

    describe('createJsonInsertTool', () => {
        it('should insert JSON value', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1, insertId: 0 });

            const tool = createJsonInsertTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.key',
                value: '"new_value"',
                where: 'id = 1'
            }, mockContext);

            const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_INSERT');
        });
    });

    describe('createJsonReplaceTool', () => {
        it('should replace JSON value', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1, insertId: 0 });

            const tool = createJsonReplaceTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$.key',
                value: '"new_value"',
                where: 'id = 1'
            }, mockContext);

            const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_REPLACE');
        });
    });

    describe('createJsonRemoveTool', () => {
        it('should remove JSON paths', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1, insertId: 0 });

            const tool = createJsonRemoveTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                paths: ['$.k1', '$.k2'],
                where: 'id = 1'
            }, mockContext);

            const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_REMOVE');
            // Should contain multiple ? based on paths length
            // Implementation: JSON_REMOVE(\`json_col\`, ?, ?)
        });
    });

    describe('createJsonContainsTool', () => {
        it('should check if JSON contains value', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ id: 1 }]));

            const tool = createJsonContainsTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                value: '"search_term"'
            }, mockContext);

            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_CONTAINS');
        });

        it('should include path if provided', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createJsonContainsTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                value: '"search_term"',
                path: '$.key'
            }, mockContext);

            // Expect JSON_CONTAINS(col, val, path)
            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            const args = mockAdapter.executeReadQuery.mock.calls[0][1] as unknown[];
            expect(call).toContain('JSON_CONTAINS');
            expect(args).toHaveLength(2); // jsonValue, path
        });
    });

    describe('createJsonKeysTool', () => {
        it('should get JSON keys', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ json_keys: '["a", "b"]' }]));

            const tool = createJsonKeysTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col'
            }, mockContext);

            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_KEYS');
        });
    });

    describe('createJsonArrayAppendTool', () => {
        it('should append to JSON array', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({ rowsAffected: 1, insertId: 0 });

            const tool = createJsonArrayAppendTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'data',
                column: 'json_col',
                path: '$',
                value: '"item"',
                where: 'id = 1'
            }, mockContext);

            const call = mockAdapter.executeWriteQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_ARRAY_APPEND');
        });
    });
});

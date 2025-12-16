/**
 * mysql-mcp - JSON Enhanced Tools Unit Tests
 * 
 * Comprehensive tests for enhanced.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createJsonMergeTool,
    createJsonDiffTool,
    createJsonNormalizeTool,
    createJsonStatsTool,
    createJsonIndexSuggestTool
} from '../enhanced.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../../__tests__/mocks/index.js';

describe('JSON Enhanced Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    describe('createJsonMergeTool', () => {
        it('should merge JSON using patch mode', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ merged: '{"a":1}' }]));

            const tool = createJsonMergeTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                json1: '{}',
                json2: '{"a":1}',
                mode: 'patch'
            }, mockContext) as { merged: any };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_MERGE_PATCH');
            expect(result.merged).toEqual({ a: 1 });
        });

        it('should merge JSON using preserve mode', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{ merged: '[1, 2]' }]));

            const tool = createJsonMergeTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                json1: '[1]',
                json2: '[2]',
                mode: 'preserve'
            }, mockContext);

            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_MERGE_PRESERVE');
        });
    });

    describe('createJsonDiffTool', () => {
        it('should compare JSON documents', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{
                identical: 1,
                json1_contains_json2: 1,
                json2_contains_json1: 1
            }]));

            const tool = createJsonDiffTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                json1: '{}',
                json2: '{}'
            }, mockContext) as { identical: boolean };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            expect(result.identical).toBe(true);
        });
    });

    describe('createJsonNormalizeTool', () => {
        it('should normalize JSON keys', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ key_name: 'k1' }, { key_name: 'k2' }])) // Keys
                .mockResolvedValueOnce(createMockQueryResult([{ value_type: 'INTEGER', count: 10 }])) // k1 types
                .mockResolvedValueOnce(createMockQueryResult([{ value_type: 'STRING', count: 5 }])); // k2 types

            const tool = createJsonNormalizeTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col',
                limit: 10
            }, mockContext) as { uniqueKeys: string[] };

            expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
            expect(result.uniqueKeys).toEqual(['k1', 'k2']);
        });
    });

    describe('createJsonStatsTool', () => {
        it('should calculate JSON stats', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{
                total_rows: 100,
                null_count: 5,
                avg_length: 10
            }]));

            const tool = createJsonStatsTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col'
            }, mockContext) as { totalSampled: number };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.totalSampled).toBe(100);
        });
    });

    describe('createJsonIndexSuggestTool', () => {
        it('should suggest indexes for high cardinality keys', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce(createMockQueryResult([{ key_name: 'id' }, { key_name: 'type' }])) // Keys
                .mockResolvedValueOnce(createMockQueryResult([{ value_type: 'INTEGER', cardinality: 50 }])) // id card
                .mockResolvedValueOnce(createMockQueryResult([{ value_type: 'STRING', cardinality: 5 }])); // type card

            const tool = createJsonIndexSuggestTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'data',
                column: 'json_col'
            }, mockContext) as { suggestions: any[] };

            expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);
            expect(result.suggestions).toHaveLength(2);
            expect(result.suggestions[0].path).toBe('$.id'); // higher cardinality first
            expect(result.suggestions[0].indexDdl).toContain('BIGINT');
        });
    });
});

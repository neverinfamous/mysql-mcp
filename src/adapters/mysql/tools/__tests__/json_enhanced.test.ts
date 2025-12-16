/**
 * mysql-mcp - JSON Enhanced Tools Unit Tests
 * 
 * Tests for JSON enhanced tool definitions and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJsonEnhancedTools } from '../json/index.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockQueryResult, createMockRequestContext } from '../../../../__tests__/mocks/index.js';

describe('getJsonEnhancedTools', () => {
    let tools: ReturnType<typeof getJsonEnhancedTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getJsonEnhancedTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    });

    it('should return 5 enhanced JSON tools', () => {
        expect(tools).toHaveLength(5);
    });

    it('should include merge, diff, normalize, stats, index_suggest', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('mysql_json_merge');
        expect(toolNames).toContain('mysql_json_diff');
        expect(toolNames).toContain('mysql_json_normalize');
        expect(toolNames).toContain('mysql_json_stats');
        expect(toolNames).toContain('mysql_json_index_suggest');
    });

    it('mysql_json_diff should be read-only', () => {
        const tool = tools.find(t => t.name === 'mysql_json_diff')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });
});

describe('JSON Enhanced Handler Execution', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let tools: ReturnType<typeof getJsonEnhancedTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        tools = getJsonEnhancedTools(mockAdapter as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();
    });

    describe('mysql_json_merge', () => {
        it('should merge JSON documents using patch mode', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(
                createMockQueryResult([{ merged: '{"a":1,"b":2}' }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_merge')!;
            const result = await tool.handler({
                json1: '{"a":1}',
                json2: '{"b":2}',
                mode: 'patch'
            }, mockContext) as { merged: unknown; mode: string };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_MERGE_PATCH');
            expect(result.mode).toBe('patch');
        });

        it('should merge JSON documents using preserve mode', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(
                createMockQueryResult([{ merged: '{"a":[1,2]}' }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_merge')!;
            await tool.handler({
                json1: '{"a":[1]}',
                json2: '{"a":[2]}',
                mode: 'preserve'
            }, mockContext);

            const call = mockAdapter.executeReadQuery.mock.calls[0][0] as string;
            expect(call).toContain('JSON_MERGE_PRESERVE');
        });
    });

    describe('mysql_json_diff', () => {
        it('should compute JSON diff and compare documents', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(
                createMockQueryResult([{
                    identical: 0,
                    json1_contains_json2: 0,
                    json2_contains_json1: 0,
                    json1_length: 2,
                    json2_length: 2,
                    json1_keys: '["a","b"]',
                    json2_keys: '["a","c"]'
                }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_diff')!;
            const result = await tool.handler({
                json1: '{"a":1,"b":2}',
                json2: '{"a":1,"c":3}'
            }, mockContext) as { identical: boolean; json1Keys: string[] };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            expect(result.identical).toBe(false);
            expect(result.json1Keys).toEqual(['a', 'b']);
        });

        it('should detect identical JSON documents', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(
                createMockQueryResult([{
                    identical: 1,
                    json1_contains_json2: 1,
                    json2_contains_json1: 1,
                    json1_length: 1,
                    json2_length: 1,
                    json1_keys: '["a"]',
                    json2_keys: '["a"]'
                }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_diff')!;
            const result = await tool.handler({
                json1: '{"a":1}',
                json2: '{"a":1}'
            }, mockContext) as { identical: boolean };

            expect(result.identical).toBe(true);
        });
    });

    describe('mysql_json_normalize', () => {
        it('should extract unique keys from JSON column', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce(
                createMockQueryResult([{ key_name: 'name' }, { key_name: 'email' }])
            ).mockResolvedValue(
                createMockQueryResult([{ value_type: 'STRING', count: 10 }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_normalize')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                limit: 100
            }, mockContext) as { uniqueKeys: string[]; keyCount: number };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.uniqueKeys).toEqual(['name', 'email']);
            expect(result.keyCount).toBe(2);
        });

        it('should reject invalid table names', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_normalize')!;

            await expect(tool.handler({
                table: 'users; DROP TABLE--',
                column: 'metadata',
                limit: 100
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column names', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_normalize')!;

            await expect(tool.handler({
                table: 'users',
                column: 'data/*comment*/',
                limit: 100
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should handle database errors during normalization', async () => {
            mockAdapter.executeQuery.mockRejectedValue(new Error('Database error'));

            const tool = tools.find(t => t.name === 'mysql_json_normalize')!;
            await expect(tool.handler({
                table: 'users',
                column: 'metadata',
                limit: 100
            }, mockContext)).rejects.toThrow('Database error');
        });
    });

    describe('mysql_json_stats', () => {
        it('should compute JSON column statistics', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([{
                    total_rows: 100,
                    null_count: 5,
                    avg_length: 3.5,
                    max_length: 10,
                    min_length: 1,
                    avg_depth: 2.1,
                    max_depth: 4,
                    avg_size_bytes: 150,
                    max_size_bytes: 500
                }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_stats')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                sampleSize: 1000
            }, mockContext) as {
                totalSampled: number;
                nullCount: number;
                length: { avg: number; max: number; min: number };
                depth: { avg: number; max: number };
            };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.totalSampled).toBe(100);
            expect(result.nullCount).toBe(5);
            expect(result.length.avg).toBe(3.5);
            expect(result.depth.max).toBe(4);
        });

        it('should reject invalid identifiers', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_stats')!;

            await expect(tool.handler({
                table: '1invalid',
                column: 'metadata',
                sampleSize: 100
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should handle zero rows', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([{
                    total_rows: 0,
                    null_count: 0
                }])
            );

            const tool = tools.find(t => t.name === 'mysql_json_stats')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                sampleSize: 100
            }, mockContext);

            expect(result).toBeDefined();
        });
    });

    describe('mysql_json_index_suggest', () => {
        it('should suggest indexes for JSON paths', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_index_suggest')!;

            mockAdapter.executeQuery
                .mockResolvedValueOnce(
                    createMockQueryResult([{ key_name: 'user_id' }, { key_name: 'email' }])
                )
                .mockResolvedValueOnce(
                    createMockQueryResult([{ value_type: 'INTEGER', cardinality: 100 }])
                )
                .mockResolvedValue(
                    createMockQueryResult([{ value_type: 'STRING', cardinality: 50 }])
                );

            const result = await tool.handler({
                table: 'orders',
                column: 'details',
                sampleSize: 100
            }, mockContext) as {
                table: string;
                suggestions: Array<{ path: string; type: string; cardinality: number; indexDdl: string }>;
            };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.table).toBe('orders');
            expect(result.suggestions.length).toBeGreaterThan(0);
            expect(result.suggestions[0].indexDdl).toContain('ALTER TABLE');
        });

        it('should handle keys with low cardinality', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_index_suggest')!;

            mockAdapter.executeQuery
                .mockResolvedValueOnce(
                    createMockQueryResult([{ key_name: 'status' }])
                )
                .mockResolvedValue(
                    createMockQueryResult([{ value_type: 'BOOLEAN', cardinality: 1 }])
                );

            const result = await tool.handler({
                table: 'items',
                column: 'flags',
                sampleSize: 50
            }, mockContext) as { suggestions: unknown[] };

            // Cardinality of 1 should not be suggested
            expect(result.suggestions.length).toBe(0);
        });

        it('should reject invalid identifiers', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_index_suggest')!;

            await expect(tool.handler({
                table: 'valid_table',
                column: 'column-with-dash',
                sampleSize: 100
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should handle empty index suggestions', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_index_suggest')!;
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                sampleSize: 100
            }, mockContext) as { suggestions: unknown[] };

            expect(result.suggestions).toEqual([]);
        });

        it('should suggest indexes for high cardinality columns with type inference', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_index_suggest')!;

            // Mock keys query
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
                { key_name: 'email' },
                { key_name: 'age' },
                { key_name: 'active' }
            ]));

            // Mock cardinality queries
            // 1. email (VARCHAR)
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ value_type: 'STRING', cardinality: 100 }]));
            // 2. age (INTEGER)
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ value_type: 'INTEGER', cardinality: 50 }]));
            // 3. active (BOOLEAN) - mocked cardinality > 1 to trigger suggestion
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ value_type: 'BOOLEAN', cardinality: 2 }]));

            const result = await tool.handler({
                table: 'users',
                column: 'data'
            }, mockContext);

            const suggestions = (result as any).suggestions;
            expect(suggestions).toHaveLength(3);

            // Expected casts
            const emailSug = suggestions.find((s: any) => s.path === '$.email');
            expect(emailSug.indexDdl).toContain('CAST(JSON_EXTRACT(`data`, \'$.email\') AS VARCHAR(255))');

            const ageSug = suggestions.find((s: any) => s.path === '$.age');
            expect(ageSug.indexDdl).toContain('CAST(JSON_EXTRACT(`data`, \'$.age\') AS BIGINT)');

            const activeSug = suggestions.find((s: any) => s.path === '$.active');
            expect(activeSug.indexDdl).toContain('CAST(JSON_EXTRACT(`data`, \'$.active\') AS TINYINT(1))');
        });

        it('should not suggest index for cardinality <= 1', async () => {
            const tool = tools.find(t => t.name === 'mysql_json_index_suggest')!;
            // Mock keys query
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
                { key_name: 'status' }
            ]));

            // Mock cardinality (1)
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([{ value_type: 'STRING', cardinality: 1 }]));

            const result = await tool.handler({
                table: 'users',
                column: 'data'
            }, mockContext);

            expect((result as any).suggestions).toHaveLength(0);
        });
    });
});

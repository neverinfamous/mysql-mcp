/**
 * mysql-mcp - Performance Optimization Tools Unit Tests
 * 
 * Comprehensive tests for optimization.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createIndexRecommendationTool,
    createQueryRewriteTool,
    createForceIndexTool,
    createOptimizerTraceTool
} from '../optimization.js';
import type { MySQLAdapter } from '../../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult, createMockTableInfo } from '../../../../../__tests__/mocks/index.js';

describe('Performance Optimization Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    describe('createIndexRecommendationTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createIndexRecommendationTool(mockAdapter as unknown as MySQLAdapter);

            expect(tool.name).toBe('mysql_index_recommendation');
            expect(tool.group).toBe('optimization');
            expect(tool.requiredScopes).toContain('read');
        });

        it('should recommend indexes for ID and foreign key columns', async () => {
            const mockTableInfo = createMockTableInfo('orders');
            mockTableInfo.columns = [
                { name: 'id', type: 'int', nullable: false, primaryKey: true },
                { name: 'user_id', type: 'int', nullable: false, primaryKey: false },
                { name: 'status', type: 'varchar', nullable: false, primaryKey: false },
                { name: 'created_at', type: 'datetime', nullable: false, primaryKey: false }
            ];
            mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

            // Return only primary key index
            mockAdapter.getTableIndexes.mockResolvedValue([{
                name: 'PRIMARY',
                tableName: 'orders',
                columns: ['id'],
                unique: true,
                type: 'BTREE'
            }]);

            const tool = createIndexRecommendationTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ table: 'orders' }, mockContext) as { recommendations: unknown[] };

            expect(mockAdapter.describeTable).toHaveBeenCalledWith('orders');
            expect(result.recommendations).toHaveLength(3);

            // Check specific recommendations
            const recs = result.recommendations as { column: string; reason: string }[];
            expect(recs.find(r => r.column === 'user_id')).toBeDefined(); // Foreign key pattern
            expect(recs.find(r => r.column === 'status')).toBeDefined();  // Status column
            expect(recs.find(r => r.column === 'created_at')).toBeDefined(); // Timestamp
        });

        it('should not recommend indexes for already indexed columns', async () => {
            const mockTableInfo = createMockTableInfo('orders');
            mockTableInfo.columns = [
                { name: 'user_id', type: 'int', nullable: false, primaryKey: false }
            ];
            mockAdapter.describeTable.mockResolvedValue(mockTableInfo);

            // user_id is already indexed
            mockAdapter.getTableIndexes.mockResolvedValue([{
                name: 'idx_user_id',
                tableName: 'orders',
                columns: ['user_id'],
                unique: false,
                type: 'BTREE'
            }]);

            const tool = createIndexRecommendationTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ table: 'orders' }, mockContext) as { recommendations: unknown[] };

            expect(result.recommendations).toHaveLength(0);
        });
    });

    describe('createQueryRewriteTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createQueryRewriteTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_query_rewrite');
        });

        it('should suggest optimizations for SELECT *', async () => {
            const tool = createQueryRewriteTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ query: 'SELECT * FROM users' }, mockContext) as { suggestions: string[] };

            expect(result.suggestions).toContain('Consider selecting only needed columns instead of SELECT *');
        });

        it('should suggest optimizations for missing LIMIT', async () => {
            const tool = createQueryRewriteTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ query: 'SELECT id FROM users' }, mockContext) as { suggestions: string[] };

            expect(result.suggestions).toContain('Consider adding LIMIT to prevent large result sets');
        });

        it('should suggest optimizations for leading wildcard LIKE', async () => {
            const tool = createQueryRewriteTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ query: "SELECT id FROM users WHERE name LIKE '%Bob'" }, mockContext) as { suggestions: string[] };

            expect(result.suggestions).toContain('Leading wildcard in LIKE prevents index usage; consider FULLTEXT search');
        });

        it('should return explain plan if possible', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([{
                EXPLAIN: JSON.stringify({ query_block: {} })
            }]));

            const tool = createQueryRewriteTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ query: 'SELECT * FROM users' }, mockContext) as { explainPlan: unknown };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalled();
            expect(result.explainPlan).toBeDefined();
        });

        it('should handle explain failure gracefully', async () => {
            mockAdapter.executeReadQuery.mockRejectedValue(new Error('Explain failed'));

            const tool = createQueryRewriteTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ query: 'SELECT * FROM users' }, mockContext) as { explainPlan: unknown };

            expect(result.explainPlan).toBeUndefined();
        });
    });

    describe('createForceIndexTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_force_index');
        });

        it('should rewrite query with FORCE INDEX', async () => {
            const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'users',
                query: 'SELECT * FROM users WHERE id = 1',
                indexName: 'PRIMARY'
            }, mockContext) as { rewrittenQuery: string };

            expect(result.rewrittenQuery).toBe('SELECT * FROM `users` FORCE INDEX (`PRIMARY`) WHERE id = 1');
        });

        it('should handle table name with backticks in query', async () => {
            const tool = createForceIndexTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'users',
                query: 'SELECT * FROM `users` WHERE id = 1',
                indexName: 'idx_name'
            }, mockContext) as { rewrittenQuery: string };

            expect(result.rewrittenQuery).toBe('SELECT * FROM `users` FORCE INDEX (`idx_name`) WHERE id = 1');
        });
    });

    describe('createOptimizerTraceTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createOptimizerTraceTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_optimizer_trace');
        });

        it('should execute optimizer trace flow', async () => {
            mockAdapter.executeReadQuery
                .mockResolvedValueOnce(createMockQueryResult([])) // The query
                .mockResolvedValueOnce(createMockQueryResult([{ TRACE: '{}' }])); // The trace

            const tool = createOptimizerTraceTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({ query: 'SELECT * FROM users' }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(1, 'SET optimizer_trace="enabled=on"');
            expect(mockAdapter.executeReadQuery).toHaveBeenNthCalledWith(1, 'SELECT * FROM users');
            expect(mockAdapter.executeReadQuery).toHaveBeenNthCalledWith(2, 'SELECT * FROM information_schema.OPTIMIZER_TRACE');
            expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(2, 'SET optimizer_trace="enabled=off"');

            expect(result).toHaveProperty('trace');
        });

        it('should disable optimizer trace even on error', async () => {
            mockAdapter.executeReadQuery.mockRejectedValue(new Error('Query failed'));

            const tool = createOptimizerTraceTool(mockAdapter as unknown as MySQLAdapter);

            await expect(tool.handler({ query: 'SELECT * FROM users' }, mockContext)).rejects.toThrow('Query failed');

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SET optimizer_trace="enabled=off"');
        });
    });
});

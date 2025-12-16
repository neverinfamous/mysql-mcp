
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SchemaManager, QueryExecutor } from '../SchemaManager.js';
import { ValidationError } from '../../../types/index.js';

describe('SchemaManager', () => {
    let manager: SchemaManager;
    let mockExecutor: QueryExecutor;

    beforeEach(() => {
        mockExecutor = {
            executeQuery: vi.fn()
        };
        manager = new SchemaManager(mockExecutor);
    });

    describe('describeTable', () => {
        it('should throw validation error for invalid table name', async () => {
            await expect(manager.describeTable('invalid-table-name')).rejects.toThrow(ValidationError);
            await expect(manager.describeTable('table;drop table')).rejects.toThrow(ValidationError);
        });

        it('should correctly parsing view types', async () => {
            // Mock column info
            (mockExecutor.executeQuery as any)
                .mockResolvedValueOnce({ rows: [] }) // columns
                .mockResolvedValueOnce({
                    rows: [{ type: 'VIEW', engine: null, rowCount: null }]
                }); // table info

            const result = await manager.describeTable('my_view');
            expect(result.type).toBe('view');
            expect(result.engine).toBeNull();
        });

        it('should handle missing table', async () => {
            (mockExecutor.executeQuery as any)
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            const result = await manager.describeTable('non_existent');
            expect(result.type).toBe('table'); // Default
            expect(result.rowCount).toBeUndefined();
        });

        it('should handle qualified table names', async () => {
            (mockExecutor.executeQuery as any)
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });

            await manager.describeTable('schema.table');

            expect(mockExecutor.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('TABLE_SCHEMA = ?'),
                ['schema', 'table']
            );
        });
    });

    describe('getTableIndexes', () => {
        it('should group composite indexes correctly', async () => {
            (mockExecutor.executeQuery as any).mockResolvedValue({
                rows: [
                    { name: 'idx_composite', nonUnique: 1, columnName: 'col1', type: 'BTREE', cardinality: 100 },
                    { name: 'idx_composite', nonUnique: 1, columnName: 'col2', type: 'BTREE', cardinality: 100 }
                ]
            });

            const indexes = await manager.getTableIndexes('users');

            expect(indexes).toHaveLength(1);
            expect(indexes[0].name).toBe('idx_composite');
            expect(indexes[0].columns).toEqual(['col1', 'col2']);
            expect(indexes[0].unique).toBe(false);
        });

        it('should handle different index types', async () => {
            (mockExecutor.executeQuery as any).mockResolvedValue({
                rows: [
                    { name: 'PRIMARY', nonUnique: 0, columnName: 'id', type: 'BTREE' },
                    { name: 'idx_fulltext', nonUnique: 1, columnName: 'bio', type: 'FULLTEXT' }
                ]
            });

            const indexes = await manager.getTableIndexes('users');

            expect(indexes).toHaveLength(2);
            expect(indexes[0].type).toBe('BTREE');
            expect(indexes[0].unique).toBe(true);
            expect(indexes[1].type).toBe('FULLTEXT');
        });
    });
});

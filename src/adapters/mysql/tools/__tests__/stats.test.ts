/**
 * mysql-mcp - Stats Tools Unit Tests
 * 
 * Tests for stats tool definitions, annotations, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getStatsTools } from '../stats/index.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../__tests__/mocks/index.js';

describe('getStatsTools', () => {
    let tools: ReturnType<typeof getStatsTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        tools = getStatsTools(createMockMySQLAdapter() as unknown as MySQLAdapter);
    });

    it('should return 8 stats tools', () => {
        expect(tools).toHaveLength(8);
    });

    it('should have stats group for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('stats');
        }
    });

    it('should have handler functions for all tools', () => {
        for (const tool of tools) {
            expect(typeof tool.handler).toBe('function');
        }
    });

    it('should have inputSchema for all tools', () => {
        for (const tool of tools) {
            expect(tool.inputSchema).toBeDefined();
        }
    });

    it('should include expected tool names', () => {
        const names = tools.map(t => t.name);
        expect(names).toContain('mysql_stats_descriptive');
        expect(names).toContain('mysql_stats_percentiles');
        expect(names).toContain('mysql_stats_correlation');
        expect(names).toContain('mysql_stats_distribution');
        expect(names).toContain('mysql_stats_time_series');
        expect(names).toContain('mysql_stats_regression');
        expect(names).toContain('mysql_stats_sampling');
        expect(names).toContain('mysql_stats_histogram');
    });
});

describe('Handler Execution', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let tools: ReturnType<typeof getStatsTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        tools = getStatsTools(mockAdapter as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();
    });

    describe('mysql_stats_descriptive', () => {
        it('should calculate descriptive statistics', async () => {
            mockAdapter.executeQuery.mockImplementation(async (query) => {
                if (query.includes('COUNT(*) as count')) {
                    return createMockQueryResult([{ count: 100 }]);
                }
                if (query.includes('AVG(val) as median')) {
                    return createMockQueryResult([{ median: 50 }]);
                }
                return createMockQueryResult([{
                    count: 100,
                    mean: 50.5,
                    min: 1,
                    max: 100,
                    range: 99,
                    stddev: 10,
                    variance: 100,
                    sum: 5050
                }]);
            });

            const tool = tools.find(t => t.name === 'mysql_stats_descriptive')!;
            const result = await tool.handler({ table: 'orders', column: 'total' }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(3);

            // Verify all queries were made
            const calls = mockAdapter.executeQuery.mock.calls.map(c => c[0] as string);
            expect(calls.some(c => c.includes('COUNT(*)'))).toBe(true);
            expect(calls.some(c => c.includes('OFFSET'))).toBe(true);
            expect(calls.some(c => c.includes('as `range`'))).toBe(true);

            // Returns column, count, mean, median, stddev, etc
            expect(result).toHaveProperty('column', 'total');
            expect(result).toHaveProperty('count', 100);
            expect(result).toHaveProperty('median', 50);
            expect(result).toHaveProperty('range', 99);
        });

        it('should include where clause in all queries', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{ count: 10 }]));

            const tool = tools.find(t => t.name === 'mysql_stats_descriptive')!;
            await tool.handler({ table: 'orders', column: 'total', where: 'status = "completed"' }, mockContext);

            // Check that WHERE clause was present in all queries
            const calls = mockAdapter.executeQuery.mock.calls.map(c => c[0] as string);
            expect(calls.length).toBeGreaterThan(0);
            for (const call of calls) {
                expect(call).toContain('WHERE status = "completed"');
            }
        });

        it('should return nulls when count is 0', async () => {
            mockAdapter.executeQuery.mockImplementation(async (query) => {
                if (query.includes('COUNT(*) as count')) {
                    return createMockQueryResult([{ count: 0 }]);
                }
                return createMockQueryResult([]);
            });

            const tool = tools.find(t => t.name === 'mysql_stats_descriptive')!;
            const result = await tool.handler({ table: 'orders', column: 'total' }, mockContext);

            expect(result).toHaveProperty('count', 0);
            expect(result).toHaveProperty('mean', null);
            expect(result).toHaveProperty('median', null);
        });
    });

    describe('mysql_stats_percentiles', () => {
        it('should calculate percentiles', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([{ cnt: 100 }])
            );

            const tool = tools.find(t => t.name === 'mysql_stats_percentiles')!;
            const result = await tool.handler({ table: 'orders', column: 'total' }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            // Returns column, totalCount, percentiles
            expect(result).toHaveProperty('totalCount');
            expect(result).toHaveProperty('percentiles');
        });

        it('should use custom percentiles', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{ cnt: 100 }]));

            const tool = tools.find(t => t.name === 'mysql_stats_percentiles')!;
            await tool.handler({
                table: 'orders',
                column: 'total',
                percentiles: [10, 50, 90, 99]
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
        });
    });

    describe('mysql_stats_correlation', () => {
        it('should calculate correlation coefficient', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([{
                    correlation: 0.85,
                    sample_size: 100,
                    mean_x: 50,
                    mean_y: 60,
                    std_x: 10,
                    std_y: 12
                }])
            );

            const tool = tools.find(t => t.name === 'mysql_stats_correlation')!;
            const result = await tool.handler({
                table: 'data',
                column1: 'height',
                column2: 'weight'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('column1', 'height');
            expect(result).toHaveProperty('column2', 'weight');
            expect(result).toHaveProperty('correlation');
        });
    });

    describe('mysql_stats_distribution', () => {
        it('should analyze data distribution', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([
                    { min_val: 0, max_val: 100 }
                ])
            );

            const tool = tools.find(t => t.name === 'mysql_stats_distribution')!;
            const result = await tool.handler({
                table: 'orders',
                column: 'amount',
                buckets: 10
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('distribution');
        });
    });

    describe('mysql_stats_time_series', () => {
        it('should compute time series with moving average', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([
                    { period: '2024-01', value: 100 }
                ])
            );

            const tool = tools.find(t => t.name === 'mysql_stats_time_series')!;
            const result = await tool.handler({
                table: 'sales',
                timeColumn: 'sale_date',
                valueColumn: 'amount',
                interval: 'month'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('dataPoints');
        });
    });

    describe('mysql_stats_regression', () => {
        it('should perform linear regression', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([{
                    n: 100,
                    avg_x: 50,
                    avg_y: 60,
                    sum_x: 5000,
                    sum_y: 6000,
                    sum_xy: 310000,
                    sum_x2: 260000,
                    sum_y2: 370000
                }])
            );

            const tool = tools.find(t => t.name === 'mysql_stats_regression')!;
            const result = await tool.handler({
                table: 'data',
                xColumn: 'x',
                yColumn: 'y'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('slope');
            expect(result).toHaveProperty('intercept');
        });
    });

    describe('mysql_stats_sampling', () => {
        it('should return random sample', async () => {
            mockAdapter.executeQuery.mockResolvedValue(
                createMockQueryResult([{ id: 1 }, { id: 5 }, { id: 10 }])
            );

            const tool = tools.find(t => t.name === 'mysql_stats_sampling')!;
            const result = await tool.handler({
                table: 'users',
                sampleSize: 100
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('RAND()');
            expect(result).toHaveProperty('sample');
        });

        it('should accept specific columns', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'mysql_stats_sampling')!;
            await tool.handler({
                table: 'users',
                sampleSize: 10,
                columns: ['id', 'name']
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('`id`');
            expect(call).toContain('`name`');
        });
    });

    describe('mysql_stats_histogram', () => {
        it('should query histogram data', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'mysql_stats_histogram')!;
            const result = await tool.handler({
                table: 'orders',
                column: 'total'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should create histogram when update is true', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'mysql_stats_histogram')!;
            await tool.handler({
                table: 'orders',
                column: 'total',
                update: true,
                buckets: 32
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ANALYZE TABLE');
        });

        it('should return histogram metadata when exists', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{
                schemaName: 'test',
                tableName: 'orders',
                columnName: 'total',
                histogramType: 'singleton'
            }]));

            const tool = tools.find(t => t.name === 'mysql_stats_histogram')!;
            const result = await tool.handler({
                table: 'orders',
                column: 'total'
            }, mockContext) as { exists: boolean };

            expect(result.exists).toBe(true);
        });
    });
});

describe('Stats Validation Errors', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let tools: ReturnType<typeof getStatsTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        tools = getStatsTools(mockAdapter as unknown as MySQLAdapter);
        mockContext = createMockRequestContext();
    });

    describe('mysql_stats_descriptive', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_descriptive')!;
            await expect(tool.handler({
                table: '123-invalid',
                column: 'total'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_descriptive')!;
            await expect(tool.handler({
                table: 'orders',
                column: '123-bad'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });
    });

    describe('mysql_stats_percentiles', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_percentiles')!;
            await expect(tool.handler({
                table: '123-invalid',
                column: 'amount'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_percentiles')!;
            await expect(tool.handler({
                table: 'orders',
                column: 'bad-col'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should return empty percentiles when table is empty', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{ cnt: 0 }]));

            const tool = tools.find(t => t.name === 'mysql_stats_percentiles')!;
            const result = await tool.handler({
                table: 'empty_table',
                column: 'value'
            }, mockContext) as { totalCount: number };

            expect(result.totalCount).toBe(0);
        });
    });

    describe('mysql_stats_correlation', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_correlation')!;
            await expect(tool.handler({
                table: '123-bad',
                column1: 'x',
                column2: 'y'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column names', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_correlation')!;
            await expect(tool.handler({
                table: 'data',
                column1: 'bad-col',
                column2: 'y'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });
    });

    describe('mysql_stats_distribution', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_distribution')!;
            await expect(tool.handler({
                table: '123-bad',
                column: 'amount'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_distribution')!;
            await expect(tool.handler({
                table: 'orders',
                column: 'bad-col'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should handle same min/max values', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([
                { min_val: 50, max_val: 50 }
            ]));

            const tool = tools.find(t => t.name === 'mysql_stats_distribution')!;
            const result = await tool.handler({
                table: 'constant',
                column: 'val'
            }, mockContext) as { bucketCount: number };

            expect(result.bucketCount).toBe(1);
        });
    });

    describe('mysql_stats_time_series', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_time_series')!;
            await expect(tool.handler({
                table: '123-bad',
                valueColumn: 'amount',
                timeColumn: 'created_at'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column names', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_time_series')!;
            await expect(tool.handler({
                table: 'sales',
                valueColumn: 'bad-col',
                timeColumn: 'created_at'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should use different interval formats', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'mysql_stats_time_series')!;

            await tool.handler({
                table: 'metrics',
                valueColumn: 'value',
                timeColumn: 'ts',
                interval: 'minute'
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('%H:%i');
        });
    });

    describe('mysql_stats_regression', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_regression')!;
            await expect(tool.handler({
                table: '123-bad',
                xColumn: 'x',
                yColumn: 'y'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column names', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_regression')!;
            await expect(tool.handler({
                table: 'data',
                xColumn: 'bad-x',
                yColumn: 'y'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should return error for insufficient data points', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{
                n: 1, sum_x: 1, sum_y: 1
            }]));

            const tool = tools.find(t => t.name === 'mysql_stats_regression')!;
            const result = await tool.handler({
                table: 'small_data',
                xColumn: 'x',
                yColumn: 'y'
            }, mockContext) as { error: string };

            expect(result.error).toContain('Insufficient');
        });
    });

    describe('mysql_stats_sampling', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_sampling')!;
            await expect(tool.handler({
                table: '123-bad',
                sampleSize: 10
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column names', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_sampling')!;
            await expect(tool.handler({
                table: 'users',
                sampleSize: 10,
                columns: ['valid', 'bad-column']
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should use seed for reproducibility', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'mysql_stats_sampling')!;
            await tool.handler({
                table: 'users',
                sampleSize: 10,
                seed: 42
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('RAND(42)');
        });
    });

    describe('mysql_stats_histogram', () => {
        it('should reject invalid table name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_histogram')!;
            await expect(tool.handler({
                table: '123-bad',
                column: 'amount'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should reject invalid column name', async () => {
            const tool = tools.find(t => t.name === 'mysql_stats_histogram')!;
            await expect(tool.handler({
                table: 'orders',
                column: 'bad-col'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });
    });
});

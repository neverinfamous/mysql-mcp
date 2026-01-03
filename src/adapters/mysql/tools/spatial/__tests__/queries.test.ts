
/**
 * mysql-mcp - Spatial Queries Tools Unit Tests
 * 
 * Comprehensive tests for queries.ts module functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    createSpatialDistanceTool,
    createSpatialDistanceSphereTool,
    createSpatialContainsTool,
    createSpatialWithinTool
} from '../queries.js';
import type { MySQLAdapter } from '../../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../../__tests__/mocks/index.js';

describe('Spatial Queries Tools', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
    });

    describe('createSpatialDistanceTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createSpatialDistanceTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_spatial_distance');
        });

        it('should query distance with defaults', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([{
                id: 1,
                distance: 100
            }]));

            const tool = createSpatialDistanceTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'locations',
                spatialColumn: 'geom',
                point: { longitude: 0, latitude: 0 }
            }, mockContext) as { results: unknown[] };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_Distance');
            // Check SRID default with axis-order option
            expect(call).toContain("ST_GeomFromText(?, 4326, 'axis-order=long-lat')");
            expect(result.results).toHaveLength(1);
        });

        it('should filter by maxDistance and use custom SRID', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialDistanceTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'locations',
                spatialColumn: 'geom',
                point: { longitude: 0, latitude: 0 },
                maxDistance: 500,
                srid: 3857,
                limit: 5
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_Distance');
            expect(call).toContain('<= ?');
            expect(call).toContain("ST_GeomFromText(?, 3857, 'axis-order=long-lat')");
            expect(call).toContain('LIMIT 5');
            const args = mockAdapter.executeQuery.mock.calls[0][1] as any[];
            expect(args).toContain(500);
        });

        it('should validate table name', async () => {
            const tool = createSpatialDistanceTool(mockAdapter as unknown as MySQLAdapter);
            await expect(tool.handler({
                table: 'invalid; drop table',
                spatialColumn: 'geom',
                point: { longitude: 0, latitude: 0 }
            }, mockContext)).rejects.toThrow('Invalid table name');
        });

        it('should validate column name', async () => {
            const tool = createSpatialDistanceTool(mockAdapter as unknown as MySQLAdapter);
            await expect(tool.handler({
                table: 'valid_table',
                spatialColumn: 'invalid column',
                point: { longitude: 0, latitude: 0 }
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should handle undefined rows result', async () => {
            // Mock executeQuery returning no rows property potentially, or null rows
            mockAdapter.executeQuery.mockResolvedValue({
                fields: [],
                rows: null
            } as any);

            const tool = createSpatialDistanceTool(mockAdapter as unknown as MySQLAdapter);
            const result = await tool.handler({
                table: 'locations',
                spatialColumn: 'geom',
                point: { longitude: 0, latitude: 0 }
            }, mockContext) as any;

            expect(result.results).toEqual([]);
            expect(result.count).toBe(0);
        });
    });

    describe('createSpatialDistanceSphereTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createSpatialDistanceSphereTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_spatial_distance_sphere');
        });

        it('should query spherical distance', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialDistanceSphereTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'locations',
                spatialColumn: 'geom',
                point: { longitude: 0, latitude: 0 }
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_Distance_Sphere');
        });

        it('should support optional maxDistance', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialDistanceSphereTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'locations',
                spatialColumn: 'geom',
                point: { longitude: 0, latitude: 0 },
                maxDistance: 1000
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('<= ?');
        });

        it('should validate identifiers', async () => {
            const tool = createSpatialDistanceSphereTool(mockAdapter as unknown as MySQLAdapter);
            await expect(tool.handler({
                table: 'invalid',
                spatialColumn: 'bad-column', // Hyphens not allowed by simple regex maybe? 
                // Regex is /^[a-zA-Z_][a-zA-Z0-9_]*$/ so hyphen is invalid
                point: { longitude: 0, latitude: 0 }
            }, mockContext)).rejects.toThrow('Invalid column name');
        });
    });

    describe('createSpatialContainsTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createSpatialContainsTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_spatial_contains');
        });

        it('should query for contained geometries with default SRID', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialContainsTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'parcels',
                spatialColumn: 'boundary',
                polygon: 'POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_Contains');
            // Verify SRID is applied with default 4326
            expect(call).toContain('ST_GeomFromText(?, 4326)');
        });

        it('should support custom SRID for contains query', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialContainsTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'parcels',
                spatialColumn: 'boundary',
                polygon: 'POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))',
                srid: 3857
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_GeomFromText(?, 3857)');
        });

        it('should validate identifiers', async () => {
            const tool = createSpatialContainsTool(mockAdapter as unknown as MySQLAdapter);
            await expect(tool.handler({
                table: 'bad-table',
                spatialColumn: 'boundary',
                polygon: 'P'
            }, mockContext)).rejects.toThrow('Invalid table name');
        });
    });

    describe('createSpatialWithinTool', () => {
        it('should create tool with correct definition', () => {
            const tool = createSpatialWithinTool(mockAdapter as unknown as MySQLAdapter);
            expect(tool.name).toBe('mysql_spatial_within');
        });

        it('should query for geometries within shape with default SRID', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialWithinTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'landmarks',
                spatialColumn: 'location',
                geometry: 'POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))'
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_Within');
            // Verify SRID is applied with default 4326
            expect(call).toContain('ST_GeomFromText(?, 4326)');
        });

        it('should support custom SRID for within query', async () => {
            mockAdapter.executeQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = createSpatialWithinTool(mockAdapter as unknown as MySQLAdapter);
            await tool.handler({
                table: 'landmarks',
                spatialColumn: 'location',
                geometry: 'POLYGON((0 0, 10 0, 10 10, 0 10, 0 0))',
                srid: 3857
            }, mockContext);

            const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
            expect(call).toContain('ST_GeomFromText(?, 3857)');
        });

        it('should validate identifiers', async () => {
            const tool = createSpatialWithinTool(mockAdapter as unknown as MySQLAdapter);
            await expect(tool.handler({
                table: 't',
                spatialColumn: 'bad col',
                geometry: 'P'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });
    });
});

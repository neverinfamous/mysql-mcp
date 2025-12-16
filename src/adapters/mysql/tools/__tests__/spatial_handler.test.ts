
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpatialTools } from '../spatial/index.js';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import { createMockMySQLAdapter, createMockRequestContext, createMockQueryResult } from '../../../../__tests__/mocks/index.js';

describe('Spatial Tools Handlers', () => {
    let mockAdapter: ReturnType<typeof createMockMySQLAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let tools: ReturnType<typeof getSpatialTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockMySQLAdapter();
        mockContext = createMockRequestContext();
        tools = getSpatialTools(mockAdapter as unknown as MySQLAdapter);
    });

    const findTool = (name: string) => tools.find(t => t.name === name);

    describe('mysql_spatial_create_column', () => {
        it('should validate table and column names', async () => {
            const tool = findTool('mysql_spatial_create_column')!;

            await expect(tool.handler({
                table: 'invalid table',
                column: 'geom'
            }, mockContext)).rejects.toThrow('Invalid table name');

            await expect(tool.handler({
                table: 'users',
                column: 'invalid-column'
            }, mockContext)).rejects.toThrow('Invalid column name');
        });

        it('should execute ALTER TABLE with correct types', async () => {
            const tool = findTool('mysql_spatial_create_column')!;
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

            await tool.handler({
                table: 'users',
                column: 'location',
                type: 'POINT',
                srid: 4326,
                nullable: false
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('ALTER TABLE `users` ADD COLUMN `location` POINT SRID 4326 NOT NULL')
            );
        });
    });

    describe('mysql_spatial_create_index', () => {
        it('should validate identifiers', async () => {
            const tool = findTool('mysql_spatial_create_index')!;

            await expect(tool.handler({
                table: 'users',
                column: 'location',
                indexName: 'bad-index'
            }, mockContext)).rejects.toThrow('Invalid index name');
        });

        it('should generate default index name if not provided', async () => {
            const tool = findTool('mysql_spatial_create_index')!;
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

            const result = await tool.handler({
                table: 'users',
                column: 'location'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('CREATE SPATIAL INDEX `idx_spatial_users_location`')
            );
            expect(result).toHaveProperty('indexName', 'idx_spatial_users_location');
        });
    });

    describe('mysql_spatial_distance', () => {
        it('should include WHERE clause if maxDistance is provided', async () => {
            const tool = findTool('mysql_spatial_distance')!;
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

            await tool.handler({
                table: 'places',
                spatialColumn: 'geom',
                point: { longitude: 10, latitude: 20 },
                maxDistance: 1000
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('WHERE ST_Distance'),
                expect.arrayContaining([1000])
            );
        });

        it('should omit WHERE clause if maxDistance is missing', async () => {
            const tool = findTool('mysql_spatial_distance')!;
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([]));

            await tool.handler({
                table: 'places',
                spatialColumn: 'geom',
                point: { longitude: 10, latitude: 20 }
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.not.stringContaining('WHERE ST_Distance'),
                expect.anything()
            );
        });
    });

    describe('mysql_spatial_geojson', () => {
        it('should convert WKT to GeoJSON', async () => {
            const tool = findTool('mysql_spatial_geojson')!;
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
                { geoJson: '{"type":"Point","coordinates":[1,1]}' }
            ]));

            const result = await tool.handler({
                geometry: 'POINT(1 1)'
            }, mockContext);

            expect((result as any).conversion).toBe('WKT to GeoJSON');
            expect((result as any).geoJson).toEqual({ type: 'Point', coordinates: [1, 1] });
        });

        it('should convert GeoJSON to WKT', async () => {
            const tool = findTool('mysql_spatial_geojson')!;
            mockAdapter.executeQuery.mockResolvedValueOnce(createMockQueryResult([
                { wkt: 'POINT(1 1)' }
            ]));

            const result = await tool.handler({
                geoJson: '{"type":"Point","coordinates":[1,1]}'
            }, mockContext);

            expect((result as any).conversion).toBe('GeoJSON to WKT');
            expect((result as any).wkt).toBe('POINT(1 1)');
        });

        it('should throw if both inputs are missing (zod refinement)', async () => {
            const tool = findTool('mysql_spatial_geojson')!;
            // Note: Zod error comes from parse, which happens inside handler but Zod throws it.
            // We can check if it throws "Either geometry or geoJson must be provided"
            // Actually Zod throws ZodError, but our tool catches? No handler doesn't catch.
            await expect(tool.handler({}, mockContext)).rejects.toThrow();
        });
    });
});

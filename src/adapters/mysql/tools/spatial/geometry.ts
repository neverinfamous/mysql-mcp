/**
 * MySQL Spatial/GIS Tools - Geometry Creation
 * 
 * Tools for creating basic geometry objects.
 * 2 tools: point and polygon creation.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const PointSchema = z.object({
    longitude: z.number().describe('Longitude coordinate'),
    latitude: z.number().describe('Latitude coordinate'),
    srid: z.number().default(4326).describe('SRID')
});

const PolygonSchema = z.object({
    coordinates: z.array(z.array(z.array(z.number()).min(2).max(2))).describe('Polygon coordinates as array of rings, each ring is array of [lon, lat] pairs'),
    srid: z.number().default(4326).describe('SRID')
});

/**
 * Create a POINT geometry
 */
export function createSpatialPointTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_point',
        title: 'MySQL Create Point',
        description: 'Create a POINT geometry from longitude/latitude coordinates.',
        group: 'spatial',
        inputSchema: PointSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { longitude, latitude, srid } = PointSchema.parse(params);

            const result = await adapter.executeQuery(
                `SELECT ST_AsText(ST_SRID(ST_GeomFromText('POINT(${String(latitude)} ${String(longitude)})'), ${String(srid)})) as wkt,
                        ST_AsGeoJSON(ST_SRID(ST_GeomFromText('POINT(${String(latitude)} ${String(longitude)})'), ${String(srid)})) as geoJson`
            );

            const row = result.rows?.[0];
            const geoJsonStr = row?.['geoJson'];
            return {
                wkt: row?.['wkt'],
                geoJson: typeof geoJsonStr === 'string' ? JSON.parse(geoJsonStr) as Record<string, unknown> : null,
                srid,
                longitude,
                latitude
            };
        }
    };
}

/**
 * Create a POLYGON geometry
 */
export function createSpatialPolygonTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_polygon',
        title: 'MySQL Create Polygon',
        description: 'Create a POLYGON geometry from coordinates.',
        group: 'spatial',
        inputSchema: PolygonSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { coordinates, srid } = PolygonSchema.parse(params);

            // Build WKT polygon
            const rings = coordinates.map(ring =>
                '(' + ring.map(([lon, lat]) => `${String(lon)} ${String(lat)}`).join(', ') + ')'
            );
            const wkt = `POLYGON(${rings.join(', ')})`;

            const result = await adapter.executeQuery(
                `SELECT ST_AsText(ST_SRID(ST_GeomFromText(?), ${String(srid)})) as wkt,
                        ST_AsGeoJSON(ST_SRID(ST_GeomFromText(?), ${String(srid)})) as geoJson,
                        ST_Area(ST_SRID(ST_GeomFromText(?), ${String(srid)})) as area`,
                [wkt, wkt, wkt]
            );

            const row = result.rows?.[0];
            const geoJsonStr = row?.['geoJson'];
            return {
                wkt: row?.['wkt'],
                geoJson: typeof geoJsonStr === 'string' ? JSON.parse(geoJsonStr) as Record<string, unknown> : null,
                area: row?.['area'],
                srid
            };
        }
    };
}

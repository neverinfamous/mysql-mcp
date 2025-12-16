/**
 * MySQL Spatial/GIS Tools - Spatial Operations
 * 
 * Tools for spatial transformations and operations.
 * 4 tools: intersection, buffer, transform, geojson.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const IntersectionSchema = z.object({
    geometry1: z.string().describe('First WKT geometry'),
    geometry2: z.string().describe('Second WKT geometry'),
    srid: z.number().default(4326).describe('SRID')
});

const BufferSchema = z.object({
    geometry: z.string().describe('WKT geometry'),
    distance: z.number().describe('Buffer distance in meters'),
    srid: z.number().default(4326).describe('SRID')
});

const TransformSchema = z.object({
    geometry: z.string().describe('WKT geometry'),
    fromSrid: z.number().describe('Source SRID'),
    toSrid: z.number().describe('Target SRID')
});

const GeoJSONSchema = z.object({
    geometry: z.string().optional().describe('WKT geometry to convert to GeoJSON'),
    geoJson: z.string().optional().describe('GeoJSON to convert to WKT'),
    srid: z.number().default(4326).describe('SRID for conversion')
}).refine(
    data => (data.geometry !== undefined) !== (data.geoJson !== undefined),
    'Either geometry or geoJson must be provided, but not both'
);

/**
 * Calculate intersection of two geometries
 */
export function createSpatialIntersectionTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_intersection',
        title: 'MySQL Spatial Intersection',
        description: 'Calculate the intersection of two geometries.',
        group: 'spatial',
        inputSchema: IntersectionSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry1, geometry2, srid } = IntersectionSchema.parse(params);

            const result = await adapter.executeQuery(
                `SELECT 
                    ST_Intersects(ST_GeomFromText(?), ST_GeomFromText(?)) as intersects,
                    ST_AsText(ST_Intersection(
                        ST_SRID(ST_GeomFromText(?), ${String(srid)}),
                        ST_SRID(ST_GeomFromText(?), ${String(srid)})
                    )) as intersection_wkt,
                    ST_AsGeoJSON(ST_Intersection(
                        ST_SRID(ST_GeomFromText(?), ${String(srid)}),
                        ST_SRID(ST_GeomFromText(?), ${String(srid)})
                    )) as intersection_geojson`,
                [geometry1, geometry2, geometry1, geometry2, geometry1, geometry2]
            );

            const row = result.rows?.[0];
            const intersectionGeoJsonStr = row?.['intersection_geojson'];
            return {
                intersects: Boolean(row?.['intersects']),
                intersectionWkt: row?.['intersection_wkt'],
                intersectionGeoJson: typeof intersectionGeoJsonStr === 'string'
                    ? JSON.parse(intersectionGeoJsonStr) as Record<string, unknown>
                    : null
            };
        }
    };
}

/**
 * Create a buffer around a geometry
 */
export function createSpatialBufferTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_buffer',
        title: 'MySQL Spatial Buffer',
        description: 'Create a buffer (expanded area) around a geometry.',
        group: 'spatial',
        inputSchema: BufferSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry, distance, srid } = BufferSchema.parse(params);

            const result = await adapter.executeQuery(
                `SELECT 
                    ST_AsText(ST_Buffer(ST_SRID(ST_GeomFromText(?), ${String(srid)}), ?)) as buffer_wkt,
                    ST_AsGeoJSON(ST_Buffer(ST_SRID(ST_GeomFromText(?), ${String(srid)}), ?)) as buffer_geojson`,
                [geometry, distance, geometry, distance]
            );

            const row = result.rows?.[0];
            const bufferGeoJsonStr = row?.['buffer_geojson'];
            return {
                bufferWkt: row?.['buffer_wkt'],
                bufferGeoJson: typeof bufferGeoJsonStr === 'string'
                    ? JSON.parse(bufferGeoJsonStr) as Record<string, unknown>
                    : null,
                bufferDistance: distance,
                srid
            };
        }
    };
}

/**
 * Transform geometry between SRIDs
 */
export function createSpatialTransformTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_transform',
        title: 'MySQL Spatial Transform',
        description: 'Transform a geometry from one spatial reference system to another.',
        group: 'spatial',
        inputSchema: TransformSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry, fromSrid, toSrid } = TransformSchema.parse(params);

            const result = await adapter.executeQuery(
                `SELECT 
                    ST_AsText(ST_Transform(ST_SRID(ST_GeomFromText(?), ${String(fromSrid)}), ${String(toSrid)})) as transformed_wkt,
                    ST_AsGeoJSON(ST_Transform(ST_SRID(ST_GeomFromText(?), ${String(fromSrid)}), ${String(toSrid)})) as transformed_geojson`,
                [geometry, geometry]
            );

            const row = result.rows?.[0];
            const transformedGeoJsonStr = row?.['transformed_geojson'];
            return {
                originalWkt: geometry,
                transformedWkt: row?.['transformed_wkt'],
                transformedGeoJson: typeof transformedGeoJsonStr === 'string'
                    ? JSON.parse(transformedGeoJsonStr) as Record<string, unknown>
                    : null,
                fromSrid,
                toSrid
            };
        }
    };
}

/**
 * Convert between WKT and GeoJSON
 */
export function createSpatialGeoJSONTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_geojson',
        title: 'MySQL GeoJSON Conversion',
        description: 'Convert geometry between WKT and GeoJSON formats.',
        group: 'spatial',
        inputSchema: GeoJSONSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry, geoJson, srid } = GeoJSONSchema.parse(params);

            if (geometry) {
                // Convert WKT to GeoJSON
                const result = await adapter.executeQuery(
                    `SELECT ST_AsGeoJSON(ST_SRID(ST_GeomFromText(?), ${String(srid)})) as geoJson`,
                    [geometry]
                );

                const row = result.rows?.[0];
                const geoJsonStr = row?.['geoJson'];
                return {
                    wkt: geometry,
                    geoJson: typeof geoJsonStr === 'string' ? JSON.parse(geoJsonStr) as Record<string, unknown> : null,
                    conversion: 'WKT to GeoJSON'
                };
            } else if (geoJson) {
                // Convert GeoJSON to WKT
                const result = await adapter.executeQuery(
                    `SELECT ST_AsText(ST_GeomFromGeoJSON(?)) as wkt`,
                    [geoJson]
                );

                const row = result.rows?.[0];
                return {
                    wkt: row?.['wkt'],
                    geoJson: JSON.parse(geoJson) as Record<string, unknown>,
                    conversion: 'GeoJSON to WKT'
                };
            }

            throw new Error('Either geometry or geoJson must be provided');
        }
    };
}

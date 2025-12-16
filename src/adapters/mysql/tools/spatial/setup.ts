/**
 * MySQL Spatial/GIS Tools - Setup and Schema Management
 * 
 * Tools for creating and managing spatial columns and indexes.
 * 2 tools: column creation and index creation.
 */

import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

// =============================================================================
// Zod Schemas
// =============================================================================

const SpatialColumnSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column name'),
    type: z.enum(['POINT', 'LINESTRING', 'POLYGON', 'GEOMETRY', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRYCOLLECTION']).default('GEOMETRY').describe('Geometry type'),
    srid: z.number().default(4326).describe('Spatial Reference System ID (4326 = WGS84)'),
    nullable: z.boolean().default(true).describe('Allow NULL values')
});

const SpatialIndexSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Spatial column name'),
    indexName: z.string().optional().describe('Index name (auto-generated if not provided)')
});

/**
 * Add a spatial column to a table
 */
export function createSpatialCreateColumnTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_create_column',
        title: 'MySQL Create Spatial Column',
        description: 'Add a geometry/spatial column to an existing table.',
        group: 'spatial',
        inputSchema: SpatialColumnSchema,
        requiredScopes: ['write'],
        annotations: {
            readOnlyHint: false
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, type, srid, nullable } = SpatialColumnSchema.parse(params);

            // Validate identifiers
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
                throw new Error('Invalid column name');
            }

            const nullClause = nullable ? '' : ' NOT NULL';
            const sridClause = srid ? ` SRID ${String(srid)}` : '';

            await adapter.executeQuery(
                `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${type}${sridClause}${nullClause}`
            );

            return { success: true, table, column, type, srid };
        }
    };
}

/**
 * Create a spatial index
 */
export function createSpatialCreateIndexTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_spatial_create_index',
        title: 'MySQL Create Spatial Index',
        description: 'Create a SPATIAL index on a geometry column for faster queries.',
        group: 'spatial',
        inputSchema: SpatialIndexSchema,
        requiredScopes: ['write'],
        annotations: {
            readOnlyHint: false
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, indexName } = SpatialIndexSchema.parse(params);

            // Validate identifiers
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
                throw new Error('Invalid table name');
            }
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
                throw new Error('Invalid column name');
            }

            const idxName = indexName ?? `idx_spatial_${table}_${column}`;
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(idxName)) {
                throw new Error('Invalid index name');
            }

            await adapter.executeQuery(
                `CREATE SPATIAL INDEX \`${idxName}\` ON \`${table}\` (\`${column}\`)`
            );

            return { success: true, indexName: idxName, table, column };
        }
    };
}

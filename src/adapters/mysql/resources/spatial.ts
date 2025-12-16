/**
 * MySQL Resource - Spatial
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createSpatialResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://spatial',
        name: 'Spatial Columns',
        title: 'MySQL Spatial/GIS Columns',
        description: 'Spatial columns and indexes in the database',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.5
        },
        handler: async (_uri: string, _context: RequestContext) => {
            // Get spatial columns
            const columnsResult = await adapter.executeQuery(`
                SELECT 
                    TABLE_SCHEMA as schema_name,
                    TABLE_NAME as table_name,
                    COLUMN_NAME as column_name,
                    DATA_TYPE as data_type,
                    SRS_ID as srid
                FROM information_schema.COLUMNS
                WHERE DATA_TYPE IN ('geometry', 'point', 'linestring', 'polygon', 
                                   'multipoint', 'multilinestring', 'multipolygon', 'geometrycollection')
                  AND TABLE_SCHEMA = DATABASE()
                ORDER BY TABLE_NAME, COLUMN_NAME
            `);

            // Get spatial indexes
            const indexesResult = await adapter.executeQuery(`
                SELECT 
                    TABLE_NAME as table_name,
                    INDEX_NAME as index_name,
                    COLUMN_NAME as column_name
                FROM information_schema.STATISTICS
                WHERE INDEX_TYPE = 'SPATIAL'
                  AND TABLE_SCHEMA = DATABASE()
                ORDER BY TABLE_NAME, INDEX_NAME
            `);

            return {
                spatialColumnCount: columnsResult.rows?.length ?? 0,
                spatialColumns: columnsResult.rows ?? [],
                spatialIndexCount: indexesResult.rows?.length ?? 0,
                spatialIndexes: indexesResult.rows ?? []
            };
        }
    };
}

/**
 * MySQL Resource - Indexes
 * 
 * Index usage statistics and recommendations.
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createIndexesResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://indexes',
        name: 'Index Statistics',
        title: 'MySQL Index Statistics',
        description: 'Index usage statistics, unused indexes, and duplicate detection',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.7
        },
        handler: async (_uri: string, _context: RequestContext) => {
            // Get current database
            const dbResult = await adapter.executeQuery('SELECT DATABASE() as db');
            const database = (dbResult.rows?.[0]?.['db'] as string) ?? '';

            if (!database) {
                return { error: 'No database selected' };
            }

            // Get index statistics
            const indexResult = await adapter.executeQuery(`
                SELECT 
                    TABLE_NAME as table_name,
                    INDEX_NAME as index_name,
                    NON_UNIQUE as non_unique,
                    SEQ_IN_INDEX as seq_in_index,
                    COLUMN_NAME as column_name,
                    CARDINALITY as cardinality,
                    INDEX_TYPE as index_type
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
            `, [database]);

            // Try to get index usage from performance_schema if available
            let unusedIndexes: unknown[] = [];
            try {
                const unusedResult = await adapter.executeQuery(`
                    SELECT 
                        object_schema as schema_name,
                        object_name as table_name,
                        index_name
                    FROM performance_schema.table_io_waits_summary_by_index_usage
                    WHERE object_schema = ?
                      AND index_name IS NOT NULL
                      AND index_name != 'PRIMARY'
                      AND count_star = 0
                `, [database]);
                unusedIndexes = unusedResult.rows ?? [];
            } catch {
                // Performance schema may not be available
            }

            // Get duplicate/redundant indexes
            let duplicateIndexes: unknown[] = [];
            try {
                const dupResult = await adapter.executeQuery(`
                    SELECT 
                        a.TABLE_NAME as table_name,
                        a.INDEX_NAME as redundant_index,
                        a.COLUMN_NAME as column_name,
                        b.INDEX_NAME as dominant_index
                    FROM information_schema.STATISTICS a
                    JOIN information_schema.STATISTICS b 
                        ON a.TABLE_SCHEMA = b.TABLE_SCHEMA 
                        AND a.TABLE_NAME = b.TABLE_NAME
                        AND a.COLUMN_NAME = b.COLUMN_NAME
                        AND a.SEQ_IN_INDEX = b.SEQ_IN_INDEX
                        AND a.INDEX_NAME != b.INDEX_NAME
                    WHERE a.TABLE_SCHEMA = ?
                      AND a.SEQ_IN_INDEX = 1
                      AND (a.INDEX_NAME != 'PRIMARY' AND b.INDEX_NAME != 'PRIMARY')
                    GROUP BY a.TABLE_NAME, a.INDEX_NAME, a.COLUMN_NAME, b.INDEX_NAME
                `, [database]);
                duplicateIndexes = dupResult.rows ?? [];
            } catch {
                // May fail on older MySQL versions
            }

            return {
                database,
                total_indexes: (indexResult.rows ?? []).length,
                indexes: indexResult.rows ?? [],
                unused_indexes: unusedIndexes,
                potential_duplicates: duplicateIndexes
            };
        }
    };
}

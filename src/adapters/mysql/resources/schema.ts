/**
 * MySQL Resource - Schema
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createSchemaResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://schema',
        name: 'Database Schema',
        title: 'MySQL Database Schema',
        description: 'Full database schema including tables, views, and indexes',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.8
        },
        handler: async (_uri: string, _context: RequestContext) => {
            const schema = await adapter.getSchema();
            return schema;
        }
    };
}

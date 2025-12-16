/**
 * MySQL Resource - Tables
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createTablesResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://tables',
        name: 'Table List',
        title: 'MySQL Table List',
        description: 'List of all tables with metadata',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.9
        },
        handler: async (_uri: string, _context: RequestContext) => {
            const tables = await adapter.listTables();
            return { tables, count: tables.length };
        }
    };
}

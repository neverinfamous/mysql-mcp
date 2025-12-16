/**
 * MySQL Resource - Status
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createStatusResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://status',
        name: 'Server Status',
        title: 'MySQL Server Status',
        description: 'MySQL server status metrics',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.7
        },
        handler: async (_uri: string, _context: RequestContext) => {
            const result = await adapter.executeQuery('SHOW GLOBAL STATUS');
            const status: Record<string, string> = {};
            for (const row of result.rows ?? []) {
                status[row['Variable_name'] as string] = row['Value'] as string;
            }
            return { status };
        }
    };
}

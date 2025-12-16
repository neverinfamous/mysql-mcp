/**
 * MySQL Resource - Variables
 */
import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

export function createVariablesResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://variables',
        name: 'Server Variables',
        title: 'MySQL Server Variables',
        description: 'MySQL server configuration variables',
        mimeType: 'application/json',
        annotations: {
            audience: ['user', 'assistant'],
            priority: 0.6
        },
        handler: async (_uri: string, _context: RequestContext) => {
            const result = await adapter.executeQuery('SHOW GLOBAL VARIABLES');
            const variables: Record<string, string> = {};
            for (const row of result.rows ?? []) {
                variables[row['Variable_name'] as string] = row['Value'] as string;
            }
            return { variables };
        }
    };
}

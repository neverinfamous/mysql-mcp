/**
 * MySQL Adapter - MCP Resources
 * 
 * Resources provide structured data about the database.
 */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

/**
 * Get all MySQL resources
 */
export function getMySQLResources(adapter: MySQLAdapter): ResourceDefinition[] {
    return [
        createSchemaResource(adapter),
        createTablesResource(adapter),
        createVariablesResource(adapter),
        createStatusResource(adapter),
        createProcesslistResource(adapter),
        createPoolResource(adapter)
    ];
}

function createSchemaResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://schema',
        name: 'Database Schema',
        description: 'Full database schema including tables, views, and indexes',
        mimeType: 'application/json',
        handler: async (_uri: string, _context: RequestContext) => {
            const schema = await adapter.getSchema();
            return schema;
        }
    };
}

function createTablesResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://tables',
        name: 'Table List',
        description: 'List of all tables with metadata',
        mimeType: 'application/json',
        handler: async (_uri: string, _context: RequestContext) => {
            const tables = await adapter.listTables();
            return { tables, count: tables.length };
        }
    };
}

function createVariablesResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://variables',
        name: 'Server Variables',
        description: 'MySQL server configuration variables',
        mimeType: 'application/json',
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

function createStatusResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://status',
        name: 'Server Status',
        description: 'MySQL server status metrics',
        mimeType: 'application/json',
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

function createProcesslistResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://processlist',
        name: 'Active Processes',
        description: 'Currently running queries and connections',
        mimeType: 'application/json',
        handler: async (_uri: string, _context: RequestContext) => {
            const result = await adapter.executeQuery('SHOW FULL PROCESSLIST');
            return { processes: result.rows };
        }
    };
}

function createPoolResource(adapter: MySQLAdapter): ResourceDefinition {
    return {
        uri: 'mysql://pool',
        name: 'Connection Pool',
        description: 'Connection pool statistics',
        mimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (_uri: string, _context: RequestContext) => {
            const pool = adapter.getPool();
            if (!pool) {
                return { error: 'Pool not available' };
            }
            return { poolStats: pool.getStats() };
        }
    };
}


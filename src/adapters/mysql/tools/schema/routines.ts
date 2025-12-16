import { z } from 'zod';
import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';

const ListObjectsSchema = z.object({
    schema: z.string().optional().describe('Schema name (defaults to current database)'),
    type: z.enum(['PROCEDURE', 'FUNCTION']).optional().describe('Filter by type')
});

/**
 * List stored procedures
 */
export function createListStoredProceduresTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_list_stored_procedures',
        title: 'MySQL List Stored Procedures',
        description: 'List all stored procedures with parameters and metadata.',
        group: 'schema',
        inputSchema: ListObjectsSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema } = ListObjectsSchema.parse(params);

            const query = `
                SELECT 
                    r.ROUTINE_NAME as name,
                    r.ROUTINE_TYPE as type,
                    r.DEFINER as definer,
                    r.CREATED as created,
                    r.LAST_ALTERED as lastAltered,
                    r.SQL_DATA_ACCESS as dataAccess,
                    r.SECURITY_TYPE as securityType,
                    r.ROUTINE_COMMENT as comment,
                    GROUP_CONCAT(
                        CONCAT(p.PARAMETER_MODE, ' ', p.PARAMETER_NAME, ' ', p.DATA_TYPE)
                        ORDER BY p.ORDINAL_POSITION
                        SEPARATOR ', '
                    ) as parameters
                FROM information_schema.ROUTINES r
                LEFT JOIN information_schema.PARAMETERS p 
                    ON r.ROUTINE_SCHEMA = p.SPECIFIC_SCHEMA 
                    AND r.ROUTINE_NAME = p.SPECIFIC_NAME
                    AND p.PARAMETER_MODE IS NOT NULL
                WHERE r.ROUTINE_SCHEMA = COALESCE(?, DATABASE())
                  AND r.ROUTINE_TYPE = 'PROCEDURE'
                GROUP BY r.ROUTINE_NAME, r.ROUTINE_TYPE, r.DEFINER, r.CREATED, 
                         r.LAST_ALTERED, r.SQL_DATA_ACCESS, r.SECURITY_TYPE, r.ROUTINE_COMMENT
                ORDER BY r.ROUTINE_NAME
            `;

            const result = await adapter.executeQuery(query, [schema ?? null]);
            return {
                procedures: result.rows,
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * List user-defined functions
 */
export function createListFunctionsTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_list_functions',
        title: 'MySQL List Functions',
        description: 'List all user-defined functions with return types and metadata.',
        group: 'schema',
        inputSchema: ListObjectsSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema } = ListObjectsSchema.parse(params);

            const query = `
                SELECT 
                    r.ROUTINE_NAME as name,
                    r.DATA_TYPE as returnType,
                    r.DEFINER as definer,
                    r.CREATED as created,
                    r.LAST_ALTERED as lastAltered,
                    r.SQL_DATA_ACCESS as dataAccess,
                    r.SECURITY_TYPE as securityType,
                    r.ROUTINE_COMMENT as comment,
                    r.IS_DETERMINISTIC as isDeterministic
                FROM information_schema.ROUTINES r
                WHERE r.ROUTINE_SCHEMA = COALESCE(?, DATABASE())
                  AND r.ROUTINE_TYPE = 'FUNCTION'
                ORDER BY r.ROUTINE_NAME
            `;

            const result = await adapter.executeQuery(query, [schema ?? null]);
            return {
                functions: result.rows,
                count: result.rows?.length ?? 0
            };
        }
    };
}

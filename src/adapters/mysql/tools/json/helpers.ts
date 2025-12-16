/**
 * MySQL JSON Tools - Helper Functions
 * 
 * Simplified JSON helper tools: get, update, search, validate.
 * 4 tools total.
 */

import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { JsonSearchSchema, JsonValidateSchema } from '../../types.js';
import { z } from 'zod';
import { validateQualifiedIdentifier, escapeQualifiedTable, validateIdentifier } from '../../../../utils/validators.js';

/**
 * Export all JSON helper tool creation functions
 */
export function createJsonGetTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        path: z.string(),
        id: z.union([z.string(), z.number()]),
        idColumn: z.string().default('id')
    });

    return {
        name: 'mysql_json_get',
        title: 'MySQL JSON Get',
        description: 'Simple JSON value extraction by row ID.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, id, idColumn } = schema.parse(params);

            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');
            validateIdentifier(idColumn, 'column');

            const sql = `SELECT JSON_UNQUOTE(JSON_EXTRACT(\`${column}\`, ?)) as value FROM ${escapeQualifiedTable(table)} WHERE \`${idColumn}\` = ?`;
            const result = await adapter.executeReadQuery(sql, [path, id]);

            return { value: result.rows?.[0]?.['value'] };
        }
    };
}

export function createJsonUpdateTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        path: z.string(),
        value: z.unknown(),
        id: z.union([z.string(), z.number()]),
        idColumn: z.string().default('id')
    });

    return {
        name: 'mysql_json_update',
        title: 'MySQL JSON Update',
        description: 'Simple JSON value update by row ID.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['write'],
        annotations: {
            readOnlyHint: false
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, id, idColumn } = schema.parse(params);

            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');
            validateIdentifier(idColumn, 'column');

            // Use CAST(? AS JSON) to ensure the value is interpreted as JSON, not as a raw string
            const sql = `UPDATE ${escapeQualifiedTable(table)} SET \`${column}\` = JSON_SET(\`${column}\`, ?, CAST(? AS JSON)) WHERE \`${idColumn}\` = ?`;
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

            const result = await adapter.executeWriteQuery(sql, [path, jsonValue, id]);
            return { success: result.rowsAffected === 1 };
        }
    };
}

export function createJsonSearchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_search',
        title: 'MySQL JSON Search',
        description: 'Search for a string value in JSON columns and return matching paths.',
        group: 'json',
        inputSchema: JsonSearchSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, searchValue, mode } = JsonSearchSchema.parse(params);

            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');

            const sql = `SELECT *, JSON_SEARCH(\`${column}\`, ?, ?) as match_path FROM ${escapeQualifiedTable(table)} WHERE JSON_SEARCH(\`${column}\`, ?, ?) IS NOT NULL`;

            const result = await adapter.executeReadQuery(sql, [mode, searchValue, mode, searchValue]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createJsonValidateTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_validate',
        title: 'MySQL JSON Validate',
        description: 'Validate if a string is valid JSON.',
        group: 'json',
        inputSchema: JsonValidateSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { value } = JsonValidateSchema.parse(params);

            const sql = `SELECT JSON_VALID(?) as is_valid`;
            const result = await adapter.executeReadQuery(sql, [value]);

            const isValid = result.rows?.[0]?.['is_valid'] === 1;
            return { valid: isValid };
        }
    };
}

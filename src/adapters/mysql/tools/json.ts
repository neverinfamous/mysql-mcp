/**
 * MySQL JSON Tools
 * 
 * JSON operations using MySQL's native JSON functions (5.7+).
 * 12 tools total (8 JSON + 4 helpers).
 */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    JsonExtractSchema,
    JsonSetSchema,
    JsonContainsSchema,
    JsonKeysSchema,
    JsonSearchSchema,
    JsonValidateSchema
} from '../types.js';
import { z } from 'zod';

/**
 * Get JSON operation tools
 */
export function getJsonTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createJsonExtractTool(adapter),
        createJsonSetTool(adapter),
        createJsonInsertTool(adapter),
        createJsonReplaceTool(adapter),
        createJsonRemoveTool(adapter),
        createJsonContainsTool(adapter),
        createJsonKeysTool(adapter),
        createJsonArrayAppendTool(adapter)
    ];
}

/**
 * Get JSON helper tools
 */
export function getJsonHelperTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createJsonGetTool(adapter),
        createJsonUpdateTool(adapter),
        createJsonSearchTool(adapter),
        createJsonValidateTool(adapter)
    ];
}

// =============================================================================
// Core JSON Tools
// =============================================================================

function createJsonExtractTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_extract',
        description: 'Extract values from JSON columns using JSON path expressions.',
        group: 'json',
        inputSchema: JsonExtractSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, where } = JsonExtractSchema.parse(params);

            let sql = `SELECT JSON_EXTRACT(\`${column}\`, ?) as extracted_value FROM \`${table}\``;
            const queryParams: unknown[] = [path];

            if (where) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql, queryParams);
            return { rows: result.rows };
        }
    };
}

function createJsonSetTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_set',
        description: 'Set or update values in JSON columns at specified paths.',
        group: 'json',
        inputSchema: JsonSetSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, where } = JsonSetSchema.parse(params);

            const sql = `UPDATE \`${table}\` SET \`${column}\` = JSON_SET(\`${column}\`, ?, ?) WHERE ${where}`;
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

            const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonInsertTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        path: z.string(),
        value: z.unknown(),
        where: z.string()
    });

    return {
        name: 'mysql_json_insert',
        description: 'Insert values into JSON columns only if the path does not exist.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, where } = schema.parse(params);

            const sql = `UPDATE \`${table}\` SET \`${column}\` = JSON_INSERT(\`${column}\`, ?, ?) WHERE ${where}`;
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

            const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonReplaceTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        path: z.string(),
        value: z.unknown(),
        where: z.string()
    });

    return {
        name: 'mysql_json_replace',
        description: 'Replace values in JSON columns only if the path exists.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, where } = schema.parse(params);

            const sql = `UPDATE \`${table}\` SET \`${column}\` = JSON_REPLACE(\`${column}\`, ?, ?) WHERE ${where}`;
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

            const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonRemoveTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        paths: z.array(z.string()),
        where: z.string()
    });

    return {
        name: 'mysql_json_remove',
        description: 'Remove values from JSON columns at specified paths.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, paths, where } = schema.parse(params);

            const pathPlaceholders = paths.map(() => '?').join(', ');
            const sql = `UPDATE \`${table}\` SET \`${column}\` = JSON_REMOVE(\`${column}\`, ${pathPlaceholders}) WHERE ${where}`;

            const result = await adapter.executeWriteQuery(sql, paths);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonContainsTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_contains',
        description: 'Find rows where JSON column contains a specified value.',
        group: 'json',
        inputSchema: JsonContainsSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, value, path } = JsonContainsSchema.parse(params);

            // JSON_CONTAINS expects the value to be a valid JSON document
            // Always stringify to ensure proper JSON encoding
            const jsonValue = JSON.stringify(value);
            let sql: string;
            const queryParams: unknown[] = [jsonValue];

            if (path) {
                sql = `SELECT * FROM \`${table}\` WHERE JSON_CONTAINS(\`${column}\`, ?, ?)`;
                queryParams.push(path);
            } else {
                sql = `SELECT * FROM \`${table}\` WHERE JSON_CONTAINS(\`${column}\`, ?)`;
            }

            const result = await adapter.executeReadQuery(sql, queryParams);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createJsonKeysTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_keys',
        description: 'Get the keys of a JSON object at the specified path.',
        group: 'json',
        inputSchema: JsonKeysSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path } = JsonKeysSchema.parse(params);

            const jsonPath = path ?? '$';
            const sql = `SELECT JSON_KEYS(\`${column}\`, ?) as json_keys FROM \`${table}\``;

            const result = await adapter.executeReadQuery(sql, [jsonPath]);
            return { rows: result.rows };
        }
    };
}

function createJsonArrayAppendTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        path: z.string(),
        value: z.unknown(),
        where: z.string()
    });

    return {
        name: 'mysql_json_array_append',
        description: 'Append a value to a JSON array at the specified path.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, where } = schema.parse(params);

            const sql = `UPDATE \`${table}\` SET \`${column}\` = JSON_ARRAY_APPEND(\`${column}\`, ?, ?) WHERE ${where}`;
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

            const result = await adapter.executeWriteQuery(sql, [path, jsonValue]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

// =============================================================================
// JSON Helper Tools
// =============================================================================

function createJsonGetTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        path: z.string(),
        id: z.union([z.string(), z.number()]),
        idColumn: z.string().default('id')
    });

    return {
        name: 'mysql_json_get',
        description: 'Simple JSON value extraction by row ID.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, id, idColumn } = schema.parse(params);

            const sql = `SELECT JSON_UNQUOTE(JSON_EXTRACT(\`${column}\`, ?)) as value FROM \`${table}\` WHERE \`${idColumn}\` = ?`;
            const result = await adapter.executeReadQuery(sql, [path, id]);

            return { value: result.rows?.[0]?.['value'] };
        }
    };
}

function createJsonUpdateTool(adapter: MySQLAdapter): ToolDefinition {
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
        description: 'Simple JSON value update by row ID.',
        group: 'json',
        inputSchema: schema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, id, idColumn } = schema.parse(params);

            const sql = `UPDATE \`${table}\` SET \`${column}\` = JSON_SET(\`${column}\`, ?, ?) WHERE \`${idColumn}\` = ?`;
            const jsonValue = typeof value === 'string' ? value : JSON.stringify(value);

            const result = await adapter.executeWriteQuery(sql, [path, jsonValue, id]);
            return { success: result.rowsAffected === 1 };
        }
    };
}

function createJsonSearchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_search',
        description: 'Search for a string value in JSON columns and return matching paths.',
        group: 'json',
        inputSchema: JsonSearchSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, searchValue, mode } = JsonSearchSchema.parse(params);

            const sql = `SELECT *, JSON_SEARCH(\`${column}\`, ?, ?) as match_path FROM \`${table}\` WHERE JSON_SEARCH(\`${column}\`, ?, ?) IS NOT NULL`;

            const result = await adapter.executeReadQuery(sql, [mode, searchValue, mode, searchValue]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createJsonValidateTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_json_validate',
        description: 'Validate if a string is valid JSON.',
        group: 'json',
        inputSchema: JsonValidateSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { value } = JsonValidateSchema.parse(params);

            const sql = `SELECT JSON_VALID(?) as is_valid`;
            const result = await adapter.executeReadQuery(sql, [value]);

            const isValid = result.rows?.[0]?.['is_valid'] === 1;
            return { valid: isValid };
        }
    };
}

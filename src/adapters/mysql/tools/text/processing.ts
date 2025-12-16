/**
 * MySQL Text Tools - Processing
 * 
 * Text manipulation and pattern matching tools.
 * 6 tools: regexp_match, like_search, soundex, substring, concat, collation_convert.
 */


import type { MySQLAdapter } from '../../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import {
    RegexpMatchSchema,
    LikeSearchSchema,
    SoundexSchema
} from '../../types.js';
import { z } from 'zod';
import { validateIdentifier, validateQualifiedIdentifier, validateWhereClause, escapeQualifiedTable } from '../../../../utils/validators.js';

export function createRegexpMatchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_regexp_match',
        title: 'MySQL REGEXP Match',
        description: 'Find rows where column matches a regular expression pattern.',
        group: 'text',
        inputSchema: RegexpMatchSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, pattern } = RegexpMatchSchema.parse(params);

            // Validate inputs
            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');

            const sql = `SELECT * FROM ${escapeQualifiedTable(table)} WHERE \`${column}\` REGEXP ?`;
            const result = await adapter.executeReadQuery(sql, [pattern]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createLikeSearchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_like_search',
        title: 'MySQL LIKE Search',
        description: 'Find rows using LIKE pattern matching with % and _ wildcards.',
        group: 'text',
        inputSchema: LikeSearchSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, pattern } = LikeSearchSchema.parse(params);

            // Validate inputs
            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');

            const sql = `SELECT * FROM ${escapeQualifiedTable(table)} WHERE \`${column}\` LIKE ?`;
            const result = await adapter.executeReadQuery(sql, [pattern]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createSoundexTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_soundex',
        title: 'MySQL SOUNDEX',
        description: 'Find rows with phonetically similar values using SOUNDEX.',
        group: 'text',
        inputSchema: SoundexSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, value } = SoundexSchema.parse(params);

            // Validate inputs
            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');

            const sql = `SELECT *, SOUNDEX(\`${column}\`) as soundex_value FROM ${escapeQualifiedTable(table)} WHERE SOUNDEX(\`${column}\`) = SOUNDEX(?)`;
            const result = await adapter.executeReadQuery(sql, [value]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createSubstringTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        start: z.number().describe('Starting position (1-indexed)'),
        length: z.number().optional().describe('Number of characters'),
        where: z.string().optional()
    });

    return {
        name: 'mysql_substring',
        title: 'MySQL SUBSTRING',
        description: 'Extract substrings from column values.',
        group: 'text',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, start, length, where } = schema.parse(params);

            // Validate inputs
            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');
            validateWhereClause(where);

            const substringExpr = length !== undefined
                ? `SUBSTRING(\`${column}\`, ?, ?)`
                : `SUBSTRING(\`${column}\`, ?)`;

            let sql = `SELECT *, ${substringExpr} as substring_value FROM ${escapeQualifiedTable(table)}`;
            const queryParams: unknown[] = length !== undefined ? [start, length] : [start];

            if (where !== undefined) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql, queryParams);
            return { rows: result.rows };
        }
    };
}

export function createConcatTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        columns: z.array(z.string()).describe('Columns to concatenate'),
        separator: z.string().optional().default(' ').describe('Separator between values'),
        alias: z.string().optional().default('concatenated').describe('Result column name'),
        where: z.string().optional()
    });

    return {
        name: 'mysql_concat',
        title: 'MySQL CONCAT',
        description: 'Concatenate multiple columns with an optional separator.',
        group: 'text',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, separator, alias, where } = schema.parse(params);

            // Validate inputs
            validateQualifiedIdentifier(table, 'table');
            for (const col of columns) {
                validateIdentifier(col, 'column');
            }
            validateIdentifier(alias, 'column');
            validateWhereClause(where);

            const columnList = columns.map(c => `\`${c}\``).join(', ');
            const concatExpr = `CONCAT_WS(?, ${columnList})`;

            let sql = `SELECT *, ${concatExpr} as \`${alias}\` FROM ${escapeQualifiedTable(table)}`;
            const queryParams: unknown[] = [separator];

            if (where !== undefined) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql, queryParams);
            return { rows: result.rows };
        }
    };
}

export function createCollationConvertTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        charset: z.string().describe('Target character set (e.g., utf8mb4)'),
        collation: z.string().optional().describe('Target collation'),
        where: z.string().optional()
    });

    return {
        name: 'mysql_collation_convert',
        title: 'MySQL Collation Convert',
        description: 'Convert column values to a different character set or collation.',
        group: 'text',
        inputSchema: schema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            idempotentHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, charset, collation, where } = schema.parse(params);

            // Validate inputs
            validateQualifiedIdentifier(table, 'table');
            validateIdentifier(column, 'column');
            validateWhereClause(where);
            // charset and collation are parameters for CONVERT, not identifiers in the query structure per se (but should be safe strings)
            // They are usually safe to interpolate if we trust them or validate against a list, but here we just put them in.
            // A safer approach for charset/collation would be to validate against known MySQL charsets/collations, 
            // but for now we assume they are safe or the user has rights. 
            // However, to be strictly safe, let's validate them as identifiers as they usually follow identifier rules.
            validateIdentifier(charset, 'column'); // charset names follow identifier rules
            if (collation !== undefined) validateIdentifier(collation, 'column'); // collation names follow identifier rules

            let convertExpr = `CONVERT(\`${column}\` USING ${charset})`;
            if (collation !== undefined) {
                convertExpr = `${convertExpr} COLLATE ${collation}`;
            }

            let sql = `SELECT *, ${convertExpr} as converted_value FROM ${escapeQualifiedTable(table)}`;

            if (where !== undefined) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql);
            return { rows: result.rows };
        }
    };
}

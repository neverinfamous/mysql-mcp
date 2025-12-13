/**
 * MySQL Text & Fulltext Tools
 * 
 * Text processing and FULLTEXT search operations.
 * 10 tools total (6 text + 4 fulltext).
 */

/* eslint-disable @typescript-eslint/strict-boolean-expressions */

import type { MySQLAdapter } from '../MySQLAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import {
    RegexpMatchSchema,
    LikeSearchSchema,
    SoundexSchema,
    FulltextCreateSchema,
    FulltextSearchSchema
} from '../types.js';
import { z } from 'zod';

/**
 * Get text processing tools
 */
export function getTextTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createRegexpMatchTool(adapter),
        createLikeSearchTool(adapter),
        createSoundexTool(adapter),
        createSubstringTool(adapter),
        createConcatTool(adapter),
        createCollationConvertTool(adapter)
    ];
}

/**
 * Get fulltext search tools
 */
export function getFulltextTools(adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createFulltextCreateTool(adapter),
        createFulltextSearchTool(adapter),
        createFulltextBooleanTool(adapter),
        createFulltextExpandTool(adapter)
    ];
}

// =============================================================================
// Text Tools
// =============================================================================

function createRegexpMatchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_regexp_match',
        description: 'Find rows where column matches a regular expression pattern.',
        group: 'text',
        inputSchema: RegexpMatchSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, pattern } = RegexpMatchSchema.parse(params);

            const sql = `SELECT * FROM \`${table}\` WHERE \`${column}\` REGEXP ?`;
            const result = await adapter.executeReadQuery(sql, [pattern]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createLikeSearchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_like_search',
        description: 'Find rows using LIKE pattern matching with % and _ wildcards.',
        group: 'text',
        inputSchema: LikeSearchSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, pattern } = LikeSearchSchema.parse(params);

            const sql = `SELECT * FROM \`${table}\` WHERE \`${column}\` LIKE ?`;
            const result = await adapter.executeReadQuery(sql, [pattern]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createSoundexTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_soundex',
        description: 'Find rows with phonetically similar values using SOUNDEX.',
        group: 'text',
        inputSchema: SoundexSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, value } = SoundexSchema.parse(params);

            const sql = `SELECT *, SOUNDEX(\`${column}\`) as soundex_value FROM \`${table}\` WHERE SOUNDEX(\`${column}\`) = SOUNDEX(?)`;
            const result = await adapter.executeReadQuery(sql, [value]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createSubstringTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        start: z.number().describe('Starting position (1-indexed)'),
        length: z.number().optional().describe('Number of characters'),
        where: z.string().optional()
    });

    return {
        name: 'mysql_substring',
        description: 'Extract substrings from column values.',
        group: 'text',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, start, length, where } = schema.parse(params);

            const substringExpr = length
                ? `SUBSTRING(\`${column}\`, ?, ?)`
                : `SUBSTRING(\`${column}\`, ?)`;

            let sql = `SELECT *, ${substringExpr} as substring_value FROM \`${table}\``;
            const queryParams: unknown[] = length ? [start, length] : [start];

            if (where) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql, queryParams);
            return { rows: result.rows };
        }
    };
}

function createConcatTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        columns: z.array(z.string()).describe('Columns to concatenate'),
        separator: z.string().optional().default(' ').describe('Separator between values'),
        alias: z.string().optional().default('concatenated').describe('Result column name'),
        where: z.string().optional()
    });

    return {
        name: 'mysql_concat',
        description: 'Concatenate multiple columns with an optional separator.',
        group: 'text',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, separator, alias, where } = schema.parse(params);

            const columnList = columns.map(c => `\`${c}\``).join(', ');
            const concatExpr = `CONCAT_WS(?, ${columnList})`;

            let sql = `SELECT *, ${concatExpr} as \`${alias}\` FROM \`${table}\``;
            const queryParams: unknown[] = [separator];

            if (where) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql, queryParams);
            return { rows: result.rows };
        }
    };
}

function createCollationConvertTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        column: z.string(),
        charset: z.string().describe('Target character set (e.g., utf8mb4)'),
        collation: z.string().optional().describe('Target collation'),
        where: z.string().optional()
    });

    return {
        name: 'mysql_collation_convert',
        description: 'Convert column values to a different character set or collation.',
        group: 'text',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, charset, collation, where } = schema.parse(params);

            let convertExpr = `CONVERT(\`${column}\` USING ${charset})`;
            if (collation) {
                convertExpr = `${convertExpr} COLLATE ${collation}`;
            }

            let sql = `SELECT *, ${convertExpr} as converted_value FROM \`${table}\``;

            if (where) {
                sql += ` WHERE ${where}`;
            }

            const result = await adapter.executeReadQuery(sql);
            return { rows: result.rows };
        }
    };
}

// =============================================================================
// Fulltext Tools
// =============================================================================

function createFulltextCreateTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_fulltext_create',
        description: 'Create a FULLTEXT index on specified columns for fast text search.',
        group: 'fulltext',
        inputSchema: FulltextCreateSchema,
        requiredScopes: ['write'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, indexName } = FulltextCreateSchema.parse(params);

            const name = indexName ?? `ft_${table}_${columns.join('_')}`;
            const columnList = columns.map(c => `\`${c}\``).join(', ');

            const sql = `CREATE FULLTEXT INDEX \`${name}\` ON \`${table}\` (${columnList})`;
            await adapter.executeQuery(sql);

            return { success: true, indexName: name, columns };
        }
    };
}

function createFulltextSearchTool(adapter: MySQLAdapter): ToolDefinition {
    return {
        name: 'mysql_fulltext_search',
        description: 'Perform FULLTEXT search with relevance ranking.',
        group: 'fulltext',
        inputSchema: FulltextSearchSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, query, mode } = FulltextSearchSchema.parse(params);

            const columnList = columns.map(c => `\`${c}\``).join(', ');
            let matchClause: string;

            switch (mode) {
                case 'BOOLEAN':
                    matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;
                    break;
                case 'EXPANSION':
                    matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;
                    break;
                default:
                    matchClause = `MATCH(${columnList}) AGAINST(? IN NATURAL LANGUAGE MODE)`;
            }

            const sql = `SELECT *, ${matchClause} as relevance FROM \`${table}\` WHERE ${matchClause} ORDER BY relevance DESC`;
            const result = await adapter.executeReadQuery(sql, [query, query]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createFulltextBooleanTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        columns: z.array(z.string()),
        query: z.string().describe('Boolean search query with +, -, *, etc.')
    });

    return {
        name: 'mysql_fulltext_boolean',
        description: 'Perform FULLTEXT search in BOOLEAN MODE with operators (+, -, *, etc.).',
        group: 'fulltext',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, query } = schema.parse(params);

            const columnList = columns.map(c => `\`${c}\``).join(', ');
            const matchClause = `MATCH(${columnList}) AGAINST(? IN BOOLEAN MODE)`;

            const sql = `SELECT *, ${matchClause} as relevance FROM \`${table}\` WHERE ${matchClause}`;
            const result = await adapter.executeReadQuery(sql, [query, query]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createFulltextExpandTool(adapter: MySQLAdapter): ToolDefinition {
    const schema = z.object({
        table: z.string(),
        columns: z.array(z.string()),
        query: z.string().describe('Search query to expand')
    });

    return {
        name: 'mysql_fulltext_expand',
        description: 'Perform FULLTEXT search WITH QUERY EXPANSION for finding related terms.',
        group: 'fulltext',
        inputSchema: schema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, query } = schema.parse(params);

            const columnList = columns.map(c => `\`${c}\``).join(', ');
            const matchClause = `MATCH(${columnList}) AGAINST(? WITH QUERY EXPANSION)`;

            const sql = `SELECT *, ${matchClause} as relevance FROM \`${table}\` WHERE ${matchClause} ORDER BY relevance DESC`;
            const result = await adapter.executeReadQuery(sql, [query, query]);

            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

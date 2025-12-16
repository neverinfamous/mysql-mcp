/**
 * MySQL Shell - Data Transfer Tools
 * 
 * Tools for importing and exporting data using MySQL Shell utilities.
 */

import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import {
    ShellExportTableInputSchema,
    ShellImportTableInputSchema,
    ShellImportJSONInputSchema
} from '../../types/shell-types.js';
import { getShellConfig, escapeForJS, execShellJS, execMySQLShell } from './common.js';

/**
 * Export table to file
 */
export function createShellExportTableTool(): ToolDefinition {
    return {
        name: 'mysqlsh_export_table',
        title: 'MySQL Shell Export Table',
        description: 'Export a MySQL table to a file using util.exportTable(). Supports CSV, TSV, and JSON formats with filtering.',
        group: 'shell',
        inputSchema: ShellExportTableInputSchema,
        requiredScopes: ['read'],
        annotations: {
            readOnlyHint: true,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema, table, outputPath, format, where, columns } =
                ShellExportTableInputSchema.parse(params);

            // Escape path for JavaScript
            const escapedPath = outputPath.replace(/\\/g, '\\\\');

            const options: string[] = [];
            if (format === 'csv') {
                options.push('fieldsTerminatedBy: ","');
                options.push('fieldsEnclosedBy: "\\""');
            } else if (format === 'tsv') {
                options.push('fieldsTerminatedBy: "\\t"');
            }
            if (where) {
                options.push(`where: "${escapeForJS(where)}"`);
            }
            if (columns && columns.length > 0) {
                options.push(`columns: ${JSON.stringify(columns)}`);
            }

            const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
            const jsCode = `return util.exportTable("${schema}.${table}", "${escapedPath}"${optionsStr});`;

            const result = await execShellJS(jsCode);

            return {
                success: true,
                schema,
                table,
                outputPath,
                format,
                result
            };
        }
    };
}

/**
 * Import table from file
 */
export function createShellImportTableTool(): ToolDefinition {
    return {
        name: 'mysqlsh_import_table',
        title: 'MySQL Shell Import Table',
        description: 'Parallel table import using util.importTable(). Imports CSV, TSV, or other delimited files into a MySQL table using multiple threads.',
        group: 'shell',
        inputSchema: ShellImportTableInputSchema,
        requiredScopes: ['write'],
        annotations: {
            readOnlyHint: false,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { inputPath, schema, table, threads, skipRows, columns, fieldsTerminatedBy, linesTerminatedBy } =
                ShellImportTableInputSchema.parse(params);

            const escapedPath = inputPath.replace(/\\/g, '\\\\');

            const options: string[] = [];
            options.push(`schema: "${schema}"`);
            options.push(`table: "${table}"`);
            if (threads) {
                options.push(`threads: ${threads}`);
            }
            if (skipRows !== undefined) {
                options.push(`skipRows: ${skipRows}`);
            }
            if (columns && columns.length > 0) {
                options.push(`columns: ${JSON.stringify(columns)}`);
            }
            if (fieldsTerminatedBy) {
                options.push(`fieldsTerminatedBy: ${JSON.stringify(fieldsTerminatedBy)}`);
            }
            if (linesTerminatedBy) {
                options.push(`linesTerminatedBy: ${JSON.stringify(linesTerminatedBy)}`);
            }

            const jsCode = `return util.importTable("${escapedPath}", { ${options.join(', ')} });`;

            const result = await execShellJS(jsCode);

            return {
                success: true,
                inputPath,
                schema,
                table,
                result
            };
        }
    };
}

/**
 * Import JSON documents
 */
export function createShellImportJSONTool(): ToolDefinition {
    return {
        name: 'mysqlsh_import_json',
        title: 'MySQL Shell Import JSON',
        description: 'Import JSON documents from a file using util.importJson(). Can import into a collection (X DevAPI) or a table column. REQUIRES X Protocol (port 33060).',
        group: 'shell',
        inputSchema: ShellImportJSONInputSchema,
        requiredScopes: ['write'],
        annotations: {
            readOnlyHint: false,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { inputPath, schema, collection, tableColumn, convertBsonTypes } =
                ShellImportJSONInputSchema.parse(params);
            const config = getShellConfig();

            const escapedPath = inputPath.replace(/\\/g, '\\\\');

            const options: string[] = [];
            options.push(`schema: "${schema}"`);

            if (tableColumn) {
                // Importing to a table column
                options.push(`table: "${collection}"`);
                options.push(`tableColumn: "${tableColumn}"`);
            } else {
                // Importing to a collection
                options.push(`collection: "${collection}"`);
            }

            if (convertBsonTypes) {
                options.push('convertBsonTypes: true');
            }

            const jsCode = `return util.importJson("${escapedPath}", { ${options.join(', ')} });`;

            // util.importJson() ALWAYS requires X Protocol (X DevAPI)
            const result = await execMySQLShell([
                '--uri', config.xConnectionUri,
                '--js',
                '-e', `
                    var __result__;
                    try {
                        __result__ = (function() { ${jsCode} })();
                        print(JSON.stringify({ success: true, result: __result__ }));
                    } catch (e) {
                        print(JSON.stringify({ success: false, error: e.message }));
                    }
                `
            ]);

            // Parse result
            const lines = result.stdout.trim().split('\n');
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i];
                if (!line) continue;
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('{')) {
                    let parsed: { success: boolean; result?: unknown; error?: string };
                    try {
                        parsed = JSON.parse(trimmedLine) as { success: boolean; result?: unknown; error?: string };
                    } catch {
                        continue;
                    }

                    if (!parsed.success) {
                        throw new Error(parsed.error ?? 'Unknown MySQL Shell error');
                    }
                    return {
                        success: true,
                        inputPath,
                        schema,
                        collection,
                        protocol: 'X Protocol',
                        result: parsed.result
                    };
                }
            }

            if (result.exitCode !== 0) {
                throw new Error(result.stderr || result.stdout || 'MySQL Shell import failed');
            }

            return {
                success: true,
                inputPath,
                schema,
                collection,
                protocol: 'X Protocol',
                result: { raw: result.stdout }
            };
        }
    };
}

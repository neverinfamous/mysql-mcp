/**
 * MySQL Shell - Restore and Scripting Tools
 * 
 * Tools for restoring dumps and running custom scripts.
 */

import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import {
    ShellLoadDumpInputSchema,
    ShellRunScriptInputSchema
} from '../../types/shell-types.js';
import { getShellConfig, execShellJS, execMySQLShell } from './common.js';

/**
 * Load dump to instance
 */
export function createShellLoadDumpTool(): ToolDefinition {
    return {
        name: 'mysqlsh_load_dump',
        title: 'MySQL Shell Load Dump',
        description: 'Load a MySQL Shell dump using util.loadDump(). Restores data from a dump created by dumpInstance, dumpSchemas, or dumpTables. Supports parallel loading.',
        group: 'shell',
        inputSchema: ShellLoadDumpInputSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: false,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const {
                inputDir, threads, dryRun, includeSchemas, excludeSchemas,
                includeTables, excludeTables, ignoreExistingObjects, ignoreVersion, resetProgress
            } = ShellLoadDumpInputSchema.parse(params);

            const escapedPath = inputDir.replace(/\\/g, '\\\\');

            const options: string[] = [];
            if (threads) {
                options.push(`threads: ${threads}`);
            }
            if (dryRun) {
                options.push('dryRun: true');
            }
            if (includeSchemas && includeSchemas.length > 0) {
                options.push(`includeSchemas: ${JSON.stringify(includeSchemas)}`);
            }
            if (excludeSchemas && excludeSchemas.length > 0) {
                options.push(`excludeSchemas: ${JSON.stringify(excludeSchemas)}`);
            }
            if (includeTables && includeTables.length > 0) {
                options.push(`includeTables: ${JSON.stringify(includeTables)}`);
            }
            if (excludeTables && excludeTables.length > 0) {
                options.push(`excludeTables: ${JSON.stringify(excludeTables)}`);
            }
            if (ignoreExistingObjects) {
                options.push('ignoreExistingObjects: true');
            }
            if (ignoreVersion) {
                options.push('ignoreVersion: true');
            }
            if (resetProgress) {
                options.push('resetProgress: true');
            }

            const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
            const jsCode = `return util.loadDump("${escapedPath}"${optionsStr});`;

            const result = await execShellJS(jsCode, { timeout: 3600000 });

            return {
                success: true,
                inputDir,
                dryRun: dryRun ?? false,
                result
            };
        }
    };
}

/**
 * Execute script via MySQL Shell
 */
export function createShellRunScriptTool(): ToolDefinition {
    return {
        name: 'mysqlsh_run_script',
        title: 'MySQL Shell Run Script',
        description: 'Execute a JavaScript, Python, or SQL script via MySQL Shell. Provides access to X DevAPI, AdminAPI, and all MySQL Shell features.',
        group: 'shell',
        inputSchema: ShellRunScriptInputSchema,
        requiredScopes: ['admin'],
        annotations: {
            readOnlyHint: false,
            openWorldHint: true
        },
        handler: async (params: unknown, _context: RequestContext) => {
            const { script, language, timeout } = ShellRunScriptInputSchema.parse(params);
            const config = getShellConfig();

            // Build command based on language
            let langFlag: string;
            switch (language) {
                case 'js':
                    langFlag = '--js';
                    break;
                case 'py':
                    langFlag = '--py';
                    break;
                case 'sql':
                    langFlag = '--sql';
                    break;
            }

            const args = [
                '--uri', config.connectionUri,
                langFlag,
                '-e', script
            ];

            const result = await execMySQLShell(args, { timeout });

            return {
                success: result.exitCode === 0,
                language,
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr
            };
        }
    };
}

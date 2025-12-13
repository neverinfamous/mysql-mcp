/**
 * MySQL Shell Management Tools
 * 
 * Tools for executing MySQL Shell (mysqlsh) commands via subprocess.
 * Provides access to util.* functions for backup, restore, migration, and scripting.
 * 10 tools total.
 * 
 * MySQL Shell documentation:
 * https://dev.mysql.com/doc/mysql-shell/8.0/en/
 */

import { spawn } from 'child_process';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import type { MySQLAdapter } from '../MySQLAdapter.js';
import {
    ShellVersionInputSchema,
    ShellCheckUpgradeInputSchema,
    ShellExportTableInputSchema,
    ShellImportTableInputSchema,
    ShellImportJSONInputSchema,
    ShellDumpInstanceInputSchema,
    ShellDumpSchemasInputSchema,
    ShellDumpTablesInputSchema,
    ShellLoadDumpInputSchema,
    ShellRunScriptInputSchema
} from '../types/shell-types.js';

// =============================================================================
// Configuration
// =============================================================================

interface ShellConfig {
    binPath: string;
    connectionUri: string;
    xConnectionUri: string;
    timeout: number;
    workDir: string;
}

/**
 * Get MySQL Shell configuration from environment variables
 */
function getShellConfig(): ShellConfig {
    const host = process.env['MYSQL_HOST'] ?? 'localhost';
    const port = process.env['MYSQL_PORT'] ?? '3306';
    const xPort = process.env['MYSQL_XPORT'] ?? '33060';
    const user = process.env['MYSQL_USER'] ?? 'root';
    const password = process.env['MYSQL_PASSWORD'] ?? '';
    const database = process.env['MYSQL_DATABASE'] ?? '';

    // Build connection URI for mysqlsh (classic protocol)
    const connectionUri = password
        ? `mysql://${user}:${encodeURIComponent(password)}@${host}:${port}/${database}`
        : `mysql://${user}@${host}:${port}/${database}`;

    // Build X Protocol connection URI for document operations
    const xConnectionUri = password
        ? `mysqlx://${user}:${encodeURIComponent(password)}@${host}:${xPort}/${database}`
        : `mysqlx://${user}@${host}:${xPort}/${database}`;

    return {
        binPath: process.env['MYSQLSH_PATH'] ?? 'mysqlsh',
        connectionUri,
        xConnectionUri,
        timeout: parseInt(process.env['MYSQLSH_TIMEOUT'] ?? '300000', 10),
        workDir: process.env['MYSQLSH_WORK_DIR'] ?? process.cwd()
    };
}

// =============================================================================
// Subprocess Execution Helper
// =============================================================================

interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Execute MySQL Shell command as subprocess
 */
async function execMySQLShell(
    args: string[],
    options?: {
        timeout?: number;
        cwd?: string;
        input?: string;
    }
): Promise<ExecResult> {
    const config = getShellConfig();

    return new Promise((resolve, reject) => {
        const timeout = options?.timeout ?? config.timeout;
        const cwd = options?.cwd ?? config.workDir;

        const child = spawn(config.binPath, args, {
            cwd,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';
        let killed = false;

        const timer = setTimeout(() => {
            killed = true;
            child.kill('SIGTERM');
            reject(new Error(`MySQL Shell command timed out after ${timeout}ms`));
        }, timeout);

        child.stdout.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        if (options?.input) {
            child.stdin.write(options.input);
            child.stdin.end();
        }

        child.on('close', (code) => {
            clearTimeout(timer);
            if (!killed) {
                resolve({
                    stdout,
                    stderr,
                    exitCode: code ?? 0
                });
            }
        });

        child.on('error', (err) => {
            clearTimeout(timer);
            if (err.message.includes('ENOENT')) {
                reject(new Error(
                    `MySQL Shell not found at '${config.binPath}'. ` +
                    'Please install MySQL Shell or set MYSQLSH_PATH environment variable.'
                ));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * Execute a JavaScript expression in MySQL Shell and return JSON result
 */
async function execShellJS(
    jsCode: string,
    options?: { timeout?: number }
): Promise<unknown> {
    const config = getShellConfig();

    // Wrap code to output JSON result
    const wrappedCode = `
        var __result__;
        try {
            __result__ = (function() { ${jsCode} })();
            print(JSON.stringify({ success: true, result: __result__ }));
        } catch (e) {
            print(JSON.stringify({ success: false, error: e.message }));
        }
    `;

    const result = await execMySQLShell([
        '--uri', config.connectionUri,
        '--js',
        '-e', wrappedCode
    ], options);

    // Try to parse JSON from output
    const lines = result.stdout.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line) continue;
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('{')) {
            try {
                const parsed = JSON.parse(trimmedLine) as { success: boolean; result?: unknown; error?: string };
                if (!parsed.success) {
                    throw new Error(parsed.error ?? 'Unknown MySQL Shell error');
                }
                return parsed.result;
            } catch {
                // Not valid JSON, continue searching
            }
        }
    }

    // If no JSON found, return raw output
    if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || 'MySQL Shell command failed');
    }

    return { raw: result.stdout };
}

// =============================================================================
// Tool Registration
// =============================================================================

/**
 * Get all MySQL Shell tools
 */
export function getShellTools(_adapter: MySQLAdapter): ToolDefinition[] {
    return [
        createShellVersionTool(),
        createShellCheckUpgradeTool(),
        createShellExportTableTool(),
        createShellImportTableTool(),
        createShellImportJSONTool(),
        createShellDumpInstanceTool(),
        createShellDumpSchemasTool(),
        createShellDumpTablesTool(),
        createShellLoadDumpTool(),
        createShellRunScriptTool()
    ];
}

// =============================================================================
// Info Tools
// =============================================================================

/**
 * Get MySQL Shell version and status
 */
function createShellVersionTool(): ToolDefinition {
    return {
        name: 'mysqlsh_version',
        description: 'Get MySQL Shell version and installation status. Useful for verifying MySQL Shell is available before running other shell tools.',
        group: 'shell',
        inputSchema: ShellVersionInputSchema,
        requiredScopes: ['read'],
        handler: async (_params: unknown, _context: RequestContext) => {
            const config = getShellConfig();

            const result = await execMySQLShell(['--version']);

            // Parse version from output like "mysqlsh   Ver 8.0.44 for Win64 on x86_64"
            const versionRegex = /Ver\s+(\d+\.\d+\.\d+)/;
            const versionMatch = versionRegex.exec(result.stdout);
            const version = versionMatch ? versionMatch[1] : 'unknown';

            return {
                success: true,
                version,
                binPath: config.binPath,
                rawOutput: result.stdout.trim()
            };
        }
    };
}

// =============================================================================
// Utility Tools
// =============================================================================

/**
 * Check server upgrade compatibility
 */
function createShellCheckUpgradeTool(): ToolDefinition {
    return {
        name: 'mysqlsh_check_upgrade',
        description: 'Check MySQL server upgrade compatibility using util.checkForServerUpgrade(). Identifies potential issues before upgrading to a newer MySQL version.',
        group: 'shell',
        inputSchema: ShellCheckUpgradeInputSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { targetVersion, outputFormat } = ShellCheckUpgradeInputSchema.parse(params);
            const config = getShellConfig();

            // Use connection URI string instead of session object
            // The util.checkForServerUpgrade() accepts a URI string as first arg
            const escapedUri = config.connectionUri.replace(/"/g, '\\"');
            let jsCode = `return util.checkForServerUpgrade("${escapedUri}"`;

            const options: string[] = [];
            if (targetVersion) {
                options.push(`targetVersion: "${targetVersion}"`);
            }
            if (outputFormat) {
                options.push(`outputFormat: "${outputFormat}"`);
            }

            if (options.length > 0) {
                jsCode += `, { ${options.join(', ')} }`;
            }
            jsCode += ');';

            const result = await execShellJS(jsCode, { timeout: 120000 });

            return {
                success: true,
                upgradeCheck: result
            };
        }
    };
}

// =============================================================================
// Data Transfer Tools
// =============================================================================

/**
 * Export table to file
 */
function createShellExportTableTool(): ToolDefinition {
    return {
        name: 'mysqlsh_export_table',
        description: 'Export a MySQL table to a file using util.exportTable(). Supports CSV, TSV, and JSON formats with filtering.',
        group: 'shell',
        inputSchema: ShellExportTableInputSchema,
        requiredScopes: ['read'],
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
                options.push(`where: "${where.replace(/"/g, '\\"')}"`);
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
function createShellImportTableTool(): ToolDefinition {
    return {
        name: 'mysqlsh_import_table',
        description: 'Parallel table import using util.importTable(). Imports CSV, TSV, or other delimited files into a MySQL table using multiple threads.',
        group: 'shell',
        inputSchema: ShellImportTableInputSchema,
        requiredScopes: ['write'],
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
                options.push(`fieldsTerminatedBy: "${fieldsTerminatedBy}"`);
            }
            if (linesTerminatedBy) {
                options.push(`linesTerminatedBy: "${linesTerminatedBy}"`);
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
function createShellImportJSONTool(): ToolDefinition {
    return {
        name: 'mysqlsh_import_json',
        description: 'Import JSON documents from a file using util.importJson(). Can import into a collection (X DevAPI) or a table column. REQUIRES X Protocol (port 33060).',
        group: 'shell',
        inputSchema: ShellImportJSONInputSchema,
        requiredScopes: ['write'],
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
                    try {
                        const parsed = JSON.parse(trimmedLine) as { success: boolean; result?: unknown; error?: string };
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
                    } catch {
                        // Not valid JSON, continue
                    }
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

// =============================================================================
// Backup Tools
// =============================================================================

/**
 * Dump entire MySQL instance
 */
function createShellDumpInstanceTool(): ToolDefinition {
    return {
        name: 'mysqlsh_dump_instance',
        description: 'Dump entire MySQL instance using util.dumpInstance(). Creates a compressed, parallel dump of all schemas (excluding system schemas). Ideal for full backups and migrations.',
        group: 'shell',
        inputSchema: ShellDumpInstanceInputSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { outputDir, threads, compression, dryRun, includeSchemas, excludeSchemas, consistent, users } =
                ShellDumpInstanceInputSchema.parse(params);

            const escapedPath = outputDir.replace(/\\/g, '\\\\');

            const options: string[] = [];
            if (threads) {
                options.push(`threads: ${threads}`);
            }
            if (compression && compression !== 'zstd') {
                options.push(`compression: "${compression}"`);
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
            if (consistent !== undefined && !consistent) {
                options.push('consistent: false');
            }
            if (users !== undefined && !users) {
                options.push('users: false');
            }

            const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
            const jsCode = `return util.dumpInstance("${escapedPath}"${optionsStr});`;

            const result = await execShellJS(jsCode, { timeout: 3600000 }); // 1 hour timeout

            return {
                success: true,
                outputDir,
                dryRun: dryRun ?? false,
                result
            };
        }
    };
}

/**
 * Dump selected schemas
 */
function createShellDumpSchemasTool(): ToolDefinition {
    return {
        name: 'mysqlsh_dump_schemas',
        description: 'Dump selected schemas using util.dumpSchemas(). Creates a compressed, parallel dump of specified schemas. Use for partial backups.',
        group: 'shell',
        inputSchema: ShellDumpSchemasInputSchema,
        requiredScopes: ['admin'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { schemas, outputDir, threads, compression, dryRun, includeTables, excludeTables } =
                ShellDumpSchemasInputSchema.parse(params);

            const escapedPath = outputDir.replace(/\\/g, '\\\\');

            const options: string[] = [];
            if (threads) {
                options.push(`threads: ${threads}`);
            }
            if (compression && compression !== 'zstd') {
                options.push(`compression: "${compression}"`);
            }
            if (dryRun) {
                options.push('dryRun: true');
            }
            if (includeTables && includeTables.length > 0) {
                options.push(`includeTables: ${JSON.stringify(includeTables)}`);
            }
            if (excludeTables && excludeTables.length > 0) {
                options.push(`excludeTables: ${JSON.stringify(excludeTables)}`);
            }

            const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
            const jsCode = `return util.dumpSchemas(${JSON.stringify(schemas)}, "${escapedPath}"${optionsStr});`;

            const result = await execShellJS(jsCode, { timeout: 3600000 });

            return {
                success: true,
                schemas,
                outputDir,
                dryRun: dryRun ?? false,
                result
            };
        }
    };
}

/**
 * Dump specific tables
 */
function createShellDumpTablesTool(): ToolDefinition {
    return {
        name: 'mysqlsh_dump_tables',
        description: 'Dump specific tables using util.dumpTables(). Creates a compressed, parallel dump of specified tables from a schema.',
        group: 'shell',
        inputSchema: ShellDumpTablesInputSchema,
        requiredScopes: ['read'],
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema, tables, outputDir, threads, compression, where } =
                ShellDumpTablesInputSchema.parse(params);

            const escapedPath = outputDir.replace(/\\/g, '\\\\');

            const options: string[] = [];
            if (threads) {
                options.push(`threads: ${threads}`);
            }
            if (compression && compression !== 'zstd') {
                options.push(`compression: "${compression}"`);
            }
            if (where && Object.keys(where).length > 0) {
                const whereEntries = Object.entries(where)
                    .map(([tbl, cond]) => `"${tbl}": "${cond.replace(/"/g, '\\"')}"`)
                    .join(', ');
                options.push(`where: { ${whereEntries} }`);
            }

            const optionsStr = options.length > 0 ? `, { ${options.join(', ')} }` : '';
            const jsCode = `return util.dumpTables("${schema}", ${JSON.stringify(tables)}, "${escapedPath}"${optionsStr});`;

            const result = await execShellJS(jsCode, { timeout: 3600000 });

            return {
                success: true,
                schema,
                tables,
                outputDir,
                result
            };
        }
    };
}

// =============================================================================
// Restore Tools
// =============================================================================

/**
 * Load dump to instance
 */
function createShellLoadDumpTool(): ToolDefinition {
    return {
        name: 'mysqlsh_load_dump',
        description: 'Load a MySQL Shell dump using util.loadDump(). Restores data from a dump created by dumpInstance, dumpSchemas, or dumpTables. Supports parallel loading.',
        group: 'shell',
        inputSchema: ShellLoadDumpInputSchema,
        requiredScopes: ['admin'],
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

// =============================================================================
// Scripting Tools
// =============================================================================

/**
 * Execute script via MySQL Shell
 */
function createShellRunScriptTool(): ToolDefinition {
    return {
        name: 'mysqlsh_run_script',
        description: 'Execute a JavaScript, Python, or SQL script via MySQL Shell. Provides access to X DevAPI, AdminAPI, and all MySQL Shell features.',
        group: 'shell',
        inputSchema: ShellRunScriptInputSchema,
        requiredScopes: ['admin'],
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

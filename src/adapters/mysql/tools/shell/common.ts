/**
 * MySQL Shell - Shared Configuration and Utilities
 * 
 * Configuration helpers and subprocess execution utilities shared by all shell tools.
 */

import { spawn } from 'child_process';

// =============================================================================
// Configuration
// =============================================================================

export interface ShellConfig {
    binPath: string;
    connectionUri: string;
    xConnectionUri: string;
    timeout: number;
    workDir: string;
}

/**
 * Get MySQL Shell configuration from environment variables
 */
export function getShellConfig(): ShellConfig {
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

/**
 * Escape a string for safe embedding in JavaScript string literals.
 * Escapes backslashes first, then double quotes, to prevent injection attacks.
 */
export function escapeForJS(str: string): string {
    return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// =============================================================================
// Subprocess Execution Helpers
// =============================================================================

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

/**
 * Execute MySQL Shell command as subprocess
 */
export async function execMySQLShell(
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
export async function execShellJS(
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

    // Check for critical errors in stderr (excluding common warnings)
    const stderrClean = result.stderr
        .replace(/WARNING: Using a password on the command line interface can be insecure\.\s*/gi, '')
        .trim();
    
    // Detect specific error conditions in stderr
    if (stderrClean) {
        // local_infile disabled error
        if (stderrClean.includes('local_infile') || stderrClean.includes('Loading local data is disabled')) {
            throw new Error(
                `MySQL Shell operation failed: local_infile is disabled on the server. ` +
                `Set updateServerSettings: true (requires SUPER or SYSTEM_VARIABLES_ADMIN privilege), ` +
                `or manually run: SET GLOBAL local_infile = ON`
            );
        }
        // Privilege errors
        if (stderrClean.includes('privilege') || stderrClean.includes('Access denied')) {
            throw new Error(`MySQL Shell operation failed due to insufficient privileges: ${stderrClean}`);
        }
        // Fatal dump errors
        if (stderrClean.includes('Fatal error during dump')) {
            throw new Error(
                `MySQL Shell dump failed: ${stderrClean}. ` +
                `This may be caused by missing privileges. For dumpSchemas, try excludeEvents: true. ` +
                `For dumpTables, try all: false.`
            );
        }
    }

    // Try to parse JSON from output
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
            return parsed.result;
        }
    }

    // If no JSON found but there's stderr content, that's likely an error
    if (stderrClean && result.exitCode !== 0) {
        throw new Error(stderrClean);
    }

    // If no JSON found, return raw output
    if (result.exitCode !== 0) {
        throw new Error(result.stderr || result.stdout || 'MySQL Shell command failed');
    }

    return { raw: result.stdout };
}

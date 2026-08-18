import { execFileSync } from 'child_process';
import { readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { detectDocker, resolveScriptPaths } from './utils.mjs';
import { CONFIG } from './core-config.mjs';

const { __dirname, ecosystemRoot } = resolveScriptPaths(import.meta.url);

const args = process.argv.slice(2);
const skipVerify = args.includes('--SkipVerify') || args.includes('--skip-verify');

// 🚨 AGENT INSTRUCTION: Do NOT remove detectDocker().
// This is required to route Docker commands into WSL when Docker Desktop is not installed on the Windows host.
const { dockerCmd, dockerBaseArgs } = detectDocker();

let cluster = args.includes('--Cluster') || args.includes('--cluster');

if (!cluster) {
    try {
        const out = execFileSync(dockerCmd, [...dockerBaseArgs, 'ps', '-q', '-f', 'name=^mysql-node1$'], { encoding: 'utf-8' }).trim();
        if (out) cluster = true;
    } catch (e) {
        // Suppress expected error if container doesn't exist, fallback to standalone
    }
}

let servicesRaw = '';
try {
    servicesRaw = execFileSync(dockerCmd, [...dockerBaseArgs, 'compose', 'config', '--services'], { encoding: 'utf-8', cwd: ecosystemRoot }).trim();
} catch (e) {
    console.error(`❌ Failed to execute docker compose config --services`);
    process.exit(1);
}
const mysqlNodes = servicesRaw.split('\n').filter(s => s.startsWith('mysql-node')).sort();
if (mysqlNodes.length === 0) {
    console.error('No MySQL nodes found');
    process.exit(1);
}
const firstNode = mysqlNodes[0];

const containerName = firstNode;
const targetHost = cluster ? 'mysql-router' : '127.0.0.1';
const targetPort = cluster ? CONFIG.ports.routerRW : '3306';
const mysqlHost = 'localhost';
const mysqlPort = cluster ? '3307' : '3306';
const mysqlUser = CONFIG.credentials.mysql.user;
const mysqlPassword = CONFIG.credentials.mysql.password;
const mysqlDatabase = CONFIG.database;
const targetLabel = cluster ? 'InnoDB Cluster' : 'Standalone MySQL';

const seedFile = resolve(__dirname, '../../test-seed.sql');

console.log(`\n=== MySQL-MCP Test Database Reset ===`);
console.log(`Target: ${targetLabel} (${containerName} @ ${mysqlHost}:${mysqlPort}/${mysqlDatabase})`);

if (!existsSync(seedFile)) {
    console.error(`Seed file not found: ${seedFile}`);
    process.exit(1);
}

// Reusable try-catch wrapper to handle super-read-only automatically
function withSuperReadOnlyRetry(actionFn, isRetry = false) {
    try {
        return actionFn();
    } catch (e) {
        if (!isRetry && (e.message.includes('1290') || e.message.includes('--super-read-only'))) {
            console.log(`\n[!] Detected super-read-only mode. Automatically disabling...`);
            try {
                execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', `-u${mysqlUser}`, '-e', 'SET GLOBAL super_read_only = 0'], { encoding: 'utf-8' });
                console.log(`[!] super-read-only disabled. Retrying action...`);
                return actionFn(); // retry once without recursion
            } catch (err) {
                console.error(`Failed to disable super-read-only: ${err.message}`);
                process.exit(1);
            }
        }
        throw e;
    }
}

function invokeMySql(query, noDatabase = false) {
    const db = noDatabase ? '' : mysqlDatabase;
    const args = db 
        ? [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, `-u${mysqlUser}`, db, '-e', query]
        : [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, `-u${mysqlUser}`, '-e', query];
        
    return withSuperReadOnlyRetry(() => {
        try {
            return execFileSync(dockerCmd, args, { encoding: 'utf-8', stdio: 'pipe' });
        } catch (e) {
            console.error(`Docker exec failed: ${e.message}`);
            throw e;
        }
    });
}

function invokeMySqlFile(filePath) {
    console.log(`\n[1/3] Executing seed script...`);
    
    withSuperReadOnlyRetry(() => {
        try {
            // First DB creation
            const argsDb = [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, `-u${mysqlUser}`, '-e', `CREATE DATABASE IF NOT EXISTS ${mysqlDatabase};`];
            execFileSync(dockerCmd, argsDb, { encoding: 'utf-8', stdio: 'pipe' });
            
            // Then seed
            const fileContent = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
            execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-i', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '--binary-mode', '-h', targetHost, '-P', targetPort, `-u${mysqlUser}`, mysqlDatabase], { input: fileContent, stdio: 'pipe' });
        } catch (e) {
            console.error(`Failed to execute seed file: ${e.message}`);
            throw e;
        }
    });
}

console.log(`\n[0/3] Testing connection...`);
try {
    const versionOutput = invokeMySql("SELECT VERSION();", true).trim().split('\n');
    const version = versionOutput[versionOutput.length - 1];
    console.log(`  Connected to MySQL: ${version}`);
} catch (e) {
    console.log(`\nTroubleshooting:`);
    console.log(`  1. Ensure ${containerName} container is running: docker ps | grep ${containerName}`);
    console.log(`  2. Or ensure MySQL is running locally on port ${mysqlPort}`);
    console.log(`  3. Check credentials: ${mysqlUser} / ${mysqlPassword}`);
    process.exit(1);
}

try {
    invokeMySqlFile(seedFile);
    console.log(`  Seed script executed successfully`);
} catch (e) {
    process.exit(1);
}

if (!skipVerify) {
    console.log(`\n[2/3] Verifying tables...`);
    
    let allPassed = true;
    let tableCounts = {};
    
    // Using information_schema to fix N+1 issue: batch retrieve all table counts in one query
    let success = false;
    let lastError = null;
    let stderrStr = '';
    
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const query = `SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.tables WHERE TABLE_SCHEMA = '${mysqlDatabase}';`;
            const result = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, `-u${mysqlUser}`, '-N', '-s', '-e', query], { encoding: 'utf-8', stdio: 'pipe' });
            
            const lines = result.trim().split('\n');
            for (const line of lines) {
                if (!line) continue;
                const parts = line.split('\t');
                if (parts.length >= 2) {
                    tableCounts[parts[0].trim()] = parseInt(parts[1].trim(), 10) || 0;
                }
            }
            success = true;
            break;
        } catch (e) {
            lastError = e;
            stderrStr = e.stderr ? e.stderr.toString().trim() : '';
            // Fix sleep anti-pattern: use Atomics.wait instead of spawning node process
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
        }
    }
    
    if (!success) {
        console.error(`\n[FAIL] Failed to retrieve table counts: ERROR - ${lastError.message}${stderrStr ? `\n    STDERR: ${stderrStr}` : ''}`);
        process.exit(1);
    }
    
    for (const [table, expected] of Object.entries(CONFIG.expectedTables)) {
        const count = tableCounts[table] || 0;
        if (count >= expected) {
            console.log(`  [PASS] ${table}: ${count} rows (expected: ${expected}+)`);
        } else {
            console.error(`  [FAIL] ${table}: ${count} rows (expected: ${expected})`);
            allPassed = false;
        }
    }
    
    if (!allPassed) {
        console.error(`\n[FAIL] Some verifications failed`);
        process.exit(1);
    }
} else {
    console.log(`\n[2/3] Skipping verification (--SkipVerify)`);
}

console.log(`\n[3/3] Cleaning observability database...`);
const logsDir = resolve(__dirname, '../../../logs');
const filesToClean = [
    { path: resolve(logsDir, 'mcp-audit.sqlite') },
    { path: resolve(logsDir, 'mcp-audit.sqlite-shm') },
    { path: resolve(logsDir, 'mcp-audit.sqlite-wal') },
    { path: resolve(logsDir, 'mcp-audit.sqlite-journal') },
    // Test registry files generated by metrics.test.ts
    { path: resolve(logsDir, 'test-metrics-registry.sqlite') },
    { path: resolve(logsDir, 'test-metrics-registry.sqlite-journal') },
    { path: resolve(logsDir, 'test-metrics-registry.sqlite-shm') },
    { path: resolve(logsDir, 'test-metrics-registry.sqlite-wal') }
];

let cleanedCount = 0;
let foundCount = 0;
for (const file of filesToClean) {
    const filePath = file.path;
    if (existsSync(filePath)) {
        foundCount++;
        try {
            rmSync(filePath, { force: true });
            cleanedCount++;
        } catch (e) {
            console.log(`  [WARN] Failed to delete ${file.path}: ${e.message}`);
            if (e.code === 'EPERM' || e.code === 'EBUSY') {
                console.log(`         (Ensure the MCP server is STOPPED before running this script, as Windows locks open databases)`);
            }
        }
    }
}
if (cleanedCount > 0) {
    console.log(`  [PASS] Cleared ${cleanedCount} observability database files`);
} else if (foundCount > 0) {
    console.log(`  [WARN] Found ${foundCount} files but could not delete them due to file locks (this is expected if the MCP server is running)`);
} else {
    console.log(`  [INFO] No observability database found to clean`);
}

const tableCount = Object.keys(CONFIG.expectedTables).length;
const totalExpectedRows = Object.values(CONFIG.expectedTables).reduce((a, b) => a + b, 0);

console.log(`\n[4/4] Summary`);
console.log(`  Database: ${CONFIG.database}`);
console.log(`  Tables: ${tableCount}`);
console.log(`  Total rows: ~${totalExpectedRows}\n`);
console.log(`[PASS] Database reset complete!\n`);

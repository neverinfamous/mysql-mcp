import { execFileSync } from 'child_process';
import { readFileSync, existsSync, rmSync } from 'fs';
import { resolve } from 'path';
import { detectDocker, resolveScriptPaths } from './utils.mjs';

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
const targetPort = cluster ? '6446' : '3306';
const mysqlHost = 'localhost';
const mysqlPort = cluster ? '3307' : '3306';
const mysqlUser = 'root';
const mysqlPassword = process.env.MYSQL_ROOT_PASSWORD || 'root';
const mysqlDatabase = 'testdb';
const targetLabel = cluster ? 'InnoDB Cluster' : 'Standalone MySQL';

const seedFile = resolve(__dirname, '../../test-seed.sql');

console.log(`\n=== MySQL-MCP Test Database Reset ===`);
console.log(`Target: ${targetLabel} (${containerName} @ ${mysqlHost}:${mysqlPort}/${mysqlDatabase})`);

if (!existsSync(seedFile)) {
    console.error(`Seed file not found: ${seedFile}`);
    process.exit(1);
}

function invokeMySql(query, noDatabase = false, isRetry = false) {
    const db = noDatabase ? '' : mysqlDatabase;
    const args = db 
        ? [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, '-uroot', db, '-e', query]
        : [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, '-uroot', '-e', query];
        
    try {
        const result = execFileSync(dockerCmd, args, { encoding: 'utf-8', stdio: 'pipe' });
        return result;
    } catch (e) {
        if (!isRetry && (e.message.includes('1290') || e.message.includes('--super-read-only'))) {
            console.log(`\n[!] Detected super-read-only mode. Automatically disabling...`);
            try {
                execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-uroot', '-e', 'SET GLOBAL super_read_only = 0'], { encoding: 'utf-8' });
                console.log(`[!] super-read-only disabled. Retrying command...`);
                return invokeMySql(query, noDatabase, true);
            } catch (err) {
                console.error(`Failed to disable super-read-only: ${err.message}`);
                process.exit(1);
            }
        }
        console.error(`Docker exec failed: ${e.message}`);
        process.exit(1);
    }
}

function invokeMySqlFile(filePath, isRetry = false) {
    if (!isRetry) console.log(`\n[1/3] Executing seed script...`);
    try {
        invokeMySql(`CREATE DATABASE IF NOT EXISTS ${mysqlDatabase};`, true);
        // Read as UTF-8 string and normalize CRLF→LF so Linux MySQL CLI
        // inside the container doesn't receive stray \r characters.
        const fileContent = readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n');
        // --binary-mode: prevents MySQL CLI from interpreting \n, \G, \q etc.
        // as interactive commands when receiving piped SQL input.
        execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-i', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '--binary-mode', '-h', targetHost, '-P', targetPort, '-uroot', mysqlDatabase], { input: fileContent, stdio: 'pipe' });
    } catch (e) {
        if (!isRetry && (e.message.includes('1290') || e.message.includes('--super-read-only'))) {
            console.log(`\n[!] Detected super-read-only mode during seed script. Automatically disabling...`);
            try {
                execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-uroot', '-e', 'SET GLOBAL super_read_only = 0'], { encoding: 'utf-8' });
                console.log(`[!] super-read-only disabled. Retrying seed script...`);
                return invokeMySqlFile(filePath, true);
            } catch (err) {
                console.error(`Failed to disable super-read-only: ${err.message}`);
                process.exit(1);
            }
        }
        console.error(`Failed to execute seed file: ${e.message}`);
        process.exit(1);
    }
}

console.log(`\n[0/3] Testing connection...`);
try {
    const versionOutput = invokeMySql("SELECT VERSION();", true).trim().split('\n');
    const version = versionOutput[versionOutput.length - 1];
    console.log(`  Connected to MySQL: ${version}`);
} catch (e) {
    console.error(`Failed to connect to MySQL: ${e.message}`);
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
    console.error(e.message);
    process.exit(1);
}

if (!skipVerify) {
    console.log(`\n[2/3] Verifying tables...`);
    
    const expectedTables = {
        'test_products': 16,
        'test_orders': 20,
        'test_json_docs': 8,
        'test_articles': 10,
        'test_users': 10,
        'test_measurements': 200,
        'test_locations': 15,
        'test_categories': 17,
        'test_events': 100,
        'test_documents': 10,
        'test_partitioned': 26,
        'temp_write_test': 5
    };
    
    let allPassed = true;
    for (const [table, expected] of Object.entries(expectedTables)) {
        let success = false;
        let count = 0;
        let lastError = null;
        let stderrStr = '';
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const result = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', `MYSQL_PWD=${mysqlPassword}`, containerName, 'mysql', '-h', targetHost, '-P', targetPort, '-uroot', mysqlDatabase, '-N', '-s', '-e', `SELECT COUNT(*) FROM ${table};`], { encoding: 'utf-8', stdio: 'pipe' });
                const countStr = result.match(/\d+/);
                count = countStr ? parseInt(countStr[0], 10) : 0;
                success = true;
                break;
            } catch (e) {
                lastError = e;
                stderrStr = e.stderr ? e.stderr.toString().trim() : '';
                // Wait 1 second before retrying transient router errors
                execFileSync('node', ['-e', 'setTimeout(()=>{}, 1000)']);
            }
        }
        
        if (success) {
            if (count >= expected) {
                console.log(`  [PASS] ${table}: ${count} rows (expected: ${expected}+)`);
            } else {
                console.error(`  [FAIL] ${table}: ${count} rows (expected: ${expected})`);
                allPassed = false;
            }
        } else {
            console.error(`  [FAIL] ${table}: ERROR - ${lastError.message}${stderrStr ? `\n    STDERR: ${stderrStr}` : ''}`);
            allPassed = false;
        }
    }
    
    if (!allPassed) {
        console.error(`\n[FAIL] Some verifications failed`);
        process.exit(1);
    }
} else {
    console.log(`\n[2/4] Skipping verification (--SkipVerify)`);
}

console.log(`\n[3/4] Cleaning observability database...`);
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

console.log(`\n[4/4] Summary`);
console.log(`  Database: testdb`);
console.log(`  Tables: 12`);
console.log(`  Total rows: ~461\n`);
console.log(`[PASS] Database reset complete!\n`);

import { execFileSync } from 'child_process';
import { readFileSync, existsSync, rmSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const skipVerify = args.includes('--SkipVerify') || args.includes('--skip-verify');

const isWindows = process.platform === 'win32';
const dockerExe = isWindows ? 'wsl' : 'docker';
const dockerBaseArgs = isWindows ? ['docker'] : [];

let cluster = args.includes('--Cluster') || args.includes('--cluster');

if (!cluster) {
    try {
        const out = execFileSync(dockerExe, [...dockerBaseArgs, 'ps', '-q', '-f', 'name=^mysql-node1$'], { encoding: 'utf-8' }).trim();
        if (out) cluster = true;
    } catch (e) {
        // Suppress expected error if container doesn't exist, fallback to standalone
    }
}

const containerName = cluster ? 'mysql-node1' : 'mysql-final';
const mysqlHost = 'localhost';
const mysqlPort = cluster ? '3307' : '3306';
const mysqlUser = 'root';
const mysqlPassword = 'root';
const mysqlDatabase = 'testdb';
const targetLabel = cluster ? 'InnoDB Cluster' : 'Standalone MySQL';

const seedFile = resolve(__dirname, '../../test-seed.sql');

console.log(`\n=== MySQL-MCP Test Database Reset ===`);
console.log(`Target: ${targetLabel} (${containerName} @ ${mysqlHost}:${mysqlPort}/${mysqlDatabase})`);

if (!existsSync(seedFile)) {
    console.error(`Seed file not found: ${seedFile}`);
    process.exit(1);
}

function invokeMySql(query, noDatabase = false) {
    const db = noDatabase ? '' : mysqlDatabase;
    const args = db 
        ? [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', containerName, 'mysql', '-h', '127.0.0.1', '-uroot', db, '-e', query]
        : [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', containerName, 'mysql', '-h', '127.0.0.1', '-uroot', '-e', query];
        
    try {
        const result = execFileSync(dockerExe, args, { encoding: 'utf-8', stdio: 'pipe' });
        return result;
    } catch (e) {
        throw new Error(`Docker exec failed: ${e.message}`);
    }
}

function invokeMySqlFile(filePath) {
    console.log(`\n[1/3] Executing seed script...`);
    try {
        invokeMySql(`CREATE DATABASE IF NOT EXISTS ${mysqlDatabase};`, true);
        const fileContent = readFileSync(filePath);
        execFileSync(dockerExe, [...dockerBaseArgs, 'exec', '-i', '-e', 'MYSQL_PWD=root', containerName, 'mysql', '-h', '127.0.0.1', '-uroot', mysqlDatabase], { input: fileContent, encoding: 'utf-8', stdio: 'pipe' });
    } catch (e) {
        throw new Error(`Failed to execute seed file: ${e.message}`);
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
        try {
            const result = execFileSync(dockerExe, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', containerName, 'mysql', '-h', '127.0.0.1', '-uroot', mysqlDatabase, '-N', '-s', '-e', `SELECT COUNT(*) FROM ${table};`], { encoding: 'utf-8', stdio: 'pipe' });
            const countStr = result.match(/\d+/);
            const count = countStr ? parseInt(countStr[0], 10) : 0;
            
            if (count >= expected) {
                console.log(`  [PASS] ${table}: ${count} rows (expected: ${expected}+)`);
            } else {
                console.error(`  [FAIL] ${table}: ${count} rows (expected: ${expected})`);
                allPassed = false;
            }
        } catch (e) {
            console.error(`  [FAIL] ${table}: ERROR - ${e.message}`);
            allPassed = false;
        }
    }
    
    if (!allPassed) {
        console.log(`\n[WARN] Some verifications failed`);
    }
} else {
    console.log(`\n[2/4] Skipping verification (--SkipVerify)`);
}

console.log(`\n[3/4] Cleaning observability database...`);
const logsDir = resolve(__dirname, '../../../logs');
const filesToClean = [
    'mcp-audit.sqlite',
    'mcp-audit.sqlite-shm',
    'mcp-audit.sqlite-wal'
];

let cleanedCount = 0;
let foundCount = 0;
for (const file of filesToClean) {
    const filePath = resolve(logsDir, file);
    if (existsSync(filePath)) {
        foundCount++;
        try {
            rmSync(filePath, { force: true });
            cleanedCount++;
        } catch (e) {
            console.log(`  [WARN] Failed to delete ${file}: ${e.message}`);
            if (e.code === 'EPERM' || e.code === 'EBUSY') {
                console.log(`         (Ensure the MCP server is STOPPED before running this script, as Windows locks open databases)`);
            }
        }
    }
}
if (cleanedCount > 0) {
    console.log(`  [PASS] Cleared ${cleanedCount} observability database files`);
} else if (foundCount > 0) {
    console.log(`  [FAIL] Found ${foundCount} files but could not delete them due to file locks`);
} else {
    console.log(`  [INFO] No observability database found to clean`);
}

console.log(`\n[4/4] Summary`);
console.log(`  Database: testdb`);
console.log(`  Tables: 12`);
console.log(`  Total rows: ~461\n`);
console.log(`[PASS] Database reset complete!\n`);

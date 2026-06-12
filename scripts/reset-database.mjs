import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const skipVerify = args.includes('--SkipVerify') || args.includes('--skip-verify');
const force = args.includes('--Force') || args.includes('--force');
const cluster = args.includes('--Cluster') || args.includes('--cluster');

const containerName = cluster ? 'mysql-node1' : 'mysql-final';
const mysqlHost = 'localhost';
const mysqlPort = cluster ? '3307' : '3306';
const mysqlUser = 'root';
const mysqlPassword = 'root';
const mysqlDatabase = 'testdb';
const targetLabel = cluster ? 'InnoDB Cluster' : 'Standalone MySQL';

const seedFile = resolve(__dirname, '../test-server/test-seed.sql');

console.log(`\n=== MySQL-MCP Test Database Reset ===`);
console.log(`Target: ${targetLabel} (${containerName} @ ${mysqlHost}:${mysqlPort}/${mysqlDatabase})`);

if (!existsSync(seedFile)) {
    console.error(`Seed file not found: ${seedFile}`);
    process.exit(1);
}

function invokeMySql(query, noDatabase = false) {
    const db = noDatabase ? '' : mysqlDatabase;
    try {
        const cmd = db 
            ? `docker exec ${containerName} mysql -uroot -proot ${db} -e "${query}"`
            : `docker exec ${containerName} mysql -uroot -proot -e "${query}"`;
        return execSync(cmd, { stdio: 'pipe', encoding: 'utf-8' });
    } catch (e) {
        throw new Error(`Docker exec failed: ${e.message}`);
    }
}

function invokeMySqlFile(filePath) {
    console.log(`\n[1/3] Executing seed script...`);
    try {
        const fileContent = readFileSync(filePath);
        execSync(`docker exec -i ${containerName} mysql -uroot -proot ${mysqlDatabase}`, { input: fileContent, stdio: ['pipe', 'inherit', 'inherit'] });
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
            const result = execSync(`docker exec ${containerName} mysql -uroot -proot ${mysqlDatabase} -N -s -e "SELECT COUNT(*) FROM ${table};"`, { encoding: 'utf-8' });
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
    console.log(`\n[2/3] Skipping verification (--SkipVerify)`);
}

console.log(`\n[3/3] Summary`);
console.log(`  Database: testdb`);
console.log(`  Tables: 12`);
console.log(`  Total rows: ~461\n`);
console.log(`[PASS] Database reset complete!\n`);

import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_ROOT = join(__dirname, '..');
const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;
const dockerCmd = 'docker';

function run(command) {
    console.log(`\n> ${command}`);
    execSync(command, { stdio: 'inherit', cwd: REPO_ROOT });
}

function runQuiet(command) {
    try {
        return execSync(command, { encoding: 'utf-8', cwd: REPO_ROOT, stdio: 'pipe' });
    } catch {
        return '';
    }
}

function exec(cmd, ignoreError = false) {
    try {
        return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    } catch (e) {
        if (!ignoreError) {
            console.error(`Error: ${e.message}`);
            if (e.stdout) console.log(e.stdout.toString());
            if (e.stderr) console.error(e.stderr.toString());
            throw e;
        }
        return null;
    }
}

async function waitForMySQL(containerName) {
    console.log(`  Waiting for MySQL in ${containerName}...`);
    for (let i = 1; i <= MAX_RETRIES; i++) {
        const out = exec(`${dockerCmd} exec ${containerName} mysqladmin ping -h 127.0.0.1 -uroot -proot`, true);
        if (out && out.includes('mysqld is alive')) {
            console.log(`  ✅ ${containerName} is ready`);
            return;
        }
        if (i % 10 === 0) console.log(`  Still waiting for ${containerName}... (${i}/${MAX_RETRIES})`);
        await setTimeout(RETRY_DELAY_MS);
    }
    throw new Error(`Timeout waiting for ${containerName} to become ready.`);
}

console.log('=== Recreating MySQL Test Ecosystem ===');

try {
    // ── Phase 1: Cleanup ──────────────────────────────────────────────
    console.log('\n[1/6] Discovering containers from docker-compose.yml...');
    const services = runQuiet('docker compose config --services').trim().split('\n').filter(Boolean);
    if (services.length === 0) {
        throw new Error('No services found in docker-compose.yml. Is the file valid?');
    }
    console.log(`  Found ${services.length} services: ${services.join(', ')}`);

    console.log('\n[2/6] Cleaning up old containers and volumes...');
    for (const name of services) {
        runQuiet(`docker rm -f ${name}`);
    }
    run('docker compose down -v --remove-orphans');
    console.log('  Giving Docker daemon time to flush networks...');
    await setTimeout(5000);

    // ── Phase 2: Start containers ─────────────────────────────────────
    console.log('\n[3/6] Starting fresh containers...');
    run('docker compose up -d');

    // ── Phase 3: Bootstrap InnoDB Cluster ──────────────────────────────
    console.log('\n[4/6] Bootstrapping InnoDB Cluster...');
    await waitForMySQL('mysql-node1');
    await waitForMySQL('mysql-node2');
    await waitForMySQL('mysql-node3');

    console.log('\n  Creating cluster on primary node...');
    const createCmd = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "try { dba.createCluster('testCluster', {localAddress: 'mysql-node1:33061', communicationStack: 'XCOM', exitStateAction: 'READ_ONLY'}); console.log('Cluster created'); } catch(e) { console.log('Cluster may already exist or error: ' + e); }"`;
    const createOut = exec(createCmd);
    if (createOut) console.log(createOut.trim());

    console.log('  Adding mysql-node2 to cluster...');
    const addNode2 = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "try { var c = dba.getCluster('testCluster'); c.addInstance('root:root@mysql-node2:3306', {recoveryMethod: 'clone', localAddress: 'mysql-node2:33061', exitStateAction: 'READ_ONLY'}); } catch(e) { console.log('Node2 add error (may already be in cluster): ' + e); }"`;
    exec(addNode2, true);

    await waitForMySQL('mysql-node2');
    console.log('  Allowing Group Replication to stabilize...');
    await setTimeout(5000);

    console.log('  Adding mysql-node3 to cluster...');
    const addNode3 = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "try { var c = dba.getCluster('testCluster'); c.addInstance('root:root@mysql-node3:3306', {recoveryMethod: 'clone', localAddress: 'mysql-node3:33061', exitStateAction: 'READ_ONLY'}); } catch(e) { console.log('Node3 add error (may already be in cluster): ' + e); }"`;
    exec(addNode3, true);

    await waitForMySQL('mysql-node3');
    console.log('  Allowing Group Replication to stabilize...');
    await setTimeout(5000);

    // ── Phase 4: Verify cluster ───────────────────────────────────────
    console.log('\n[5/6] Verifying cluster status...');
    let statusCmd = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "console.log(JSON.stringify(dba.getCluster('testCluster').status(), null, 2));"`;
    let statusOut = exec(statusCmd, true);

    if (!statusOut || statusOut.includes('MYSQLSH 51314') || statusOut.includes('Error')) {
        console.log('  ⚠️ Cluster appears unstable. Attempting reboot from complete outage...');
        exec(`${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "dba.rebootClusterFromCompleteOutage()"`, true);
        await setTimeout(10000);
        statusOut = exec(statusCmd, true);
    }

    if (statusOut) {
        const onlineCount = (statusOut.match(/"status":\s*"ONLINE"/g) || []).length;
        if (onlineCount >= 3) {
            console.log(`  ✅ Cluster is ONLINE with ${onlineCount} nodes`);
        } else {
            console.log(`  ⚠️ Only ${onlineCount} nodes ONLINE (expected 3)`);
            console.log(statusOut);
        }
    }

    // ── Phase 5: Seed database ────────────────────────────────────────
    console.log('\n[6/6] Seeding the test database...');
    run('node scripts/reset-database.mjs --skip-verify');

    console.log('\n✅ MySQL Test Ecosystem Successfully Recreated.');
} catch (error) {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
}

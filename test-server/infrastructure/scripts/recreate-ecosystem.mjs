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
        const out = exec(`${dockerCmd} exec -e MYSQL_PWD=root ${containerName} mysqladmin ping -h 127.0.0.1 -uroot`, true);
        if (out && out.includes('mysqld is alive')) {
            console.log(`  ✅ ${containerName} is ready`);
            return;
        }
        if (i % 10 === 0) console.log(`  Still waiting for ${containerName}... (${i}/${MAX_RETRIES})`);
        await setTimeout(RETRY_DELAY_MS);
    }
    throw new Error(`Timeout waiting for ${containerName} to become ready.`);
}

console.log('=== Recreating Unified Database Ecosystem ===');

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

    // ── Phase 2: Start databases ─────────────────────────────────────
    console.log('\n[3/6] Starting MySQL nodes...');
    run('docker compose up -d mysql-node1 mysql-node2 mysql-node3');

    // ── Phase 3: Bootstrap InnoDB Cluster ──────────────────────────────
    console.log('\n[4/6] Bootstrapping InnoDB Cluster...');
    const mysqlNodes = services.filter(s => s.startsWith('mysql-node')).sort();
    
    for (const node of mysqlNodes) {
        await waitForMySQL(node);
    }

    console.log('\n  Creating cluster on primary node...');
    const primaryNode = mysqlNodes[0];
    const createCmd = `${dockerCmd} exec ${primaryNode} mysqlsh --uri root:root@${primaryNode}:3306 --js -e "try { dba.createCluster('testCluster', {localAddress: '${primaryNode}:33061', communicationStack: 'XCOM', exitStateAction: 'READ_ONLY'}); console.log('Cluster created'); } catch(e) { console.log('Cluster may already exist or error: ' + e); }"`;
    const createOut = exec(createCmd);
    if (createOut) console.log(createOut.trim());

    for (let i = 1; i < mysqlNodes.length; i++) {
        const node = mysqlNodes[i];
        console.log(`  Adding ${node} to cluster...`);
        const addNode = `${dockerCmd} exec ${primaryNode} mysqlsh --uri root:root@${primaryNode}:3306 --js -e "try { var c = dba.getCluster('testCluster'); c.addInstance('root:root@${node}:3306', {recoveryMethod: 'clone', localAddress: '${node}:33061', exitStateAction: 'READ_ONLY'}); } catch(e) { console.log('${node} add error (may already be in cluster): ' + e); }"`;
        exec(addNode, true);

        await waitForMySQL(node);
        console.log('  Allowing Group Replication to stabilize...');
        await setTimeout(5000);
    }

    // ── Phase 3.5: Start remaining ecosystem ──────────────────────────
    console.log('\n[4.5/6] Starting remaining ecosystem containers...');
    run('docker compose up -d');

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
        // Count ONLINE members
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

    console.log('\n✅ Unified Database Ecosystem Successfully Recreated.');
} catch (error) {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
}

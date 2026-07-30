import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load secrets.env for DD_API_KEY and other environment variables
const adamicRoot = join(__dirname, '../../..');
const secretsPath = join(adamicRoot, 'secrets.env');
if (fs.existsSync(secretsPath)) {
    const envConfig = fs.readFileSync(secretsPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
            process.env[match[1]] = (match[2] || '').trim().replace(/^['"](.*?)['"]$/, '$1');
        }
    });
    process.env.WSLENV = process.env.WSLENV ? `${process.env.WSLENV}:DD_API_KEY/u` : 'DD_API_KEY/u';
}

const REPO_ROOT = join(__dirname, '..');
const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;

// ── Helpers ──────────────────────────────────────────────────────────

function wsl(command) {
    return process.platform === 'win32' ? `wsl ${command}` : command;
}

function run(command) {
    const cmd = wsl(command);
    console.log(`\n> ${cmd}`);
    execSync(cmd, { stdio: 'inherit', cwd: REPO_ROOT, env: process.env });
}

function runQuiet(command) {
    try {
        return execSync(wsl(command), { encoding: 'utf-8', cwd: REPO_ROOT, stdio: 'pipe', env: process.env }).trim();
    } catch {
        return '';
    }
}

function exec(cmd, ignoreError = false) {
    try {
        return execSync(wsl(cmd), { encoding: 'utf-8', stdio: 'pipe', env: process.env });
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

function mysqlExec(container, query) {
    return exec(`docker exec -e MYSQL_PWD=root ${container} mysql -uroot -N -s -e "${query}"`, true) || '';
}

async function waitForMySQL(containerName) {
    console.log(`  Waiting for MySQL in ${containerName}...`);
    for (let i = 1; i <= MAX_RETRIES; i++) {
        const out = exec(`docker exec -e MYSQL_PWD=root ${containerName} mysqladmin ping -h 127.0.0.1 -uroot`, true);
        if (out && out.includes('mysqld is alive')) {
            console.log(`  ✅ ${containerName} is ready`);
            return;
        }
        if (i % 10 === 0) console.log(`  Still waiting for ${containerName}... (${i}/${MAX_RETRIES})`);
        await setTimeout(RETRY_DELAY_MS);
    }
    throw new Error(`Timeout waiting for ${containerName} to become ready.`);
}

// ── Main ─────────────────────────────────────────────────────────────

console.log('=== Recreating Unified Database Ecosystem ===');

let servicesRaw;
try {
    servicesRaw = execSync(wsl('docker compose config --services'), { encoding: 'utf-8', cwd: REPO_ROOT, stdio: 'pipe' }).trim();
} catch (e) {
    // docker compose may exit non-zero for schema validation warnings (e.g., cgroupns_mode)
    // but still produce valid stdout — try to recover it
    if (e.stdout && e.stdout.trim()) {
        servicesRaw = e.stdout.trim();
    } else {
        // Fallback: manually parse docker-compose.yml for service names
        console.log('  ⚠️  docker compose config failed, falling back to YAML parsing...');
        const yamlContent = fs.readFileSync(join(REPO_ROOT, 'docker-compose.yml'), 'utf-8');
        const services = [];
        let inServices = false;
        for (const line of yamlContent.split('\n')) {
            if (line.startsWith('services:')) { inServices = true; continue; }
            if (inServices) {
                if (line.match(/^[a-zA-Z]/)) break;
                const match = line.match(/^  ([a-zA-Z0-9_-]+):/);
                if (match) services.push(match[1]);
            }
        }
        servicesRaw = services.join('\n');
        if (!servicesRaw) throw new Error('Failed to discover services from docker-compose.yml');
    }
}
const MYSQL_NODES = servicesRaw.split('\n').filter(s => s.startsWith('mysql-node')).sort();
if (MYSQL_NODES.length === 0) {
    console.error('Error: No mysql-node services found in docker-compose.yml');
    process.exit(1);
}
const MYSQL_VOLUMES = MYSQL_NODES.map(n => `infrastructure_${n}-data-v4`);

try {
    // ── Phase 0: Network setup ───────────────────────────────────────
    console.log('\n[0/6] Configuring network...');
    try {
        const wslGateway = execSync(
            'wsl bash -c "ip route show default | grep -oP \'(?<=default via )[0-9.]+\'"',
            { encoding: 'utf-8' }
        ).trim();
        if (wslGateway) {
            const envPath = join(REPO_ROOT, '.env');
            let envContent = '';
            try { envContent = fs.readFileSync(envPath, 'utf-8'); } catch {}
            const filteredLines = envContent.split('\n').filter(l => !l.startsWith('WINDOWS_HOST_IP=') && !l.startsWith('MYSQL_ROOT_PASSWORD='));
            filteredLines.push(`WINDOWS_HOST_IP=${wslGateway}`);
            filteredLines.push(`MYSQL_ROOT_PASSWORD=${process.env.MYSQL_ROOT_PASSWORD || 'root'}`);
            fs.writeFileSync(envPath, filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
            console.log(`  Windows Host IP: ${wslGateway}`);
        }
    } catch {
        console.log('  ⚠️ Could not detect WSL gateway IP (non-fatal)');
    }

    // ── Phase 1: Aggressive cleanup ──────────────────────────────────
    console.log('\n[1/6] Discovering services...');
    const services = servicesRaw.split('\n').filter(Boolean).sort();
    if (services.length === 0) {
        throw new Error('No services found in docker-compose.yml. Is the file valid?');
    }
    console.log(`  Found ${services.length} services: ${services.join(', ')}`);

    console.log('\n[2/6] Cleaning up containers, volumes, and networks...');
    // Force-remove all known service containers
    for (const name of services) {
        runQuiet(`docker rm -f ${name}`);
    }
    // Also remove any orphan containers referencing MySQL volumes (e.g., failed upgrade containers)
    for (const vol of MYSQL_VOLUMES) {
        const orphans = runQuiet(`docker ps -a --filter volume=${vol} -q`);
        if (orphans) {
            for (const id of orphans.split('\n').filter(Boolean)) {
                console.log(`  Removing orphan container ${id} (holds volume ${vol})`);
                runQuiet(`docker rm -f ${id}`);
            }
        }
    }
    await setTimeout(2000); // Let Docker release volume locks

    // Now take down compose (removes networks, orphans)
    run('docker compose down -v --remove-orphans');
    await setTimeout(3000);

    // Explicitly verify MySQL volumes are gone (race condition fix)
    for (const vol of MYSQL_VOLUMES) {
        for (let attempt = 0; attempt < 5; attempt++) {
            if (!runQuiet(`docker volume inspect ${vol}`)) break;
            console.log(`  Volume ${vol} still exists, retrying removal...`);
            runQuiet(`docker volume rm -f ${vol}`);
            await setTimeout(2000);
        }
        if (runQuiet(`docker volume inspect ${vol}`)) {
            console.error(`  ❌ FATAL: Could not remove volume ${vol}. Please run 'docker volume rm ${vol}' manually.`);
            process.exit(1);
        }
    }
    console.log('  ✅ All volumes confirmed removed');

    // ── Phase 2: Start MySQL nodes ───────────────────────────────────
    console.log('\n[3/6] Starting MySQL nodes...');
    run('docker compose up -d mysql-node1 mysql-node2 mysql-node3');

    // ── Phase 3: Bootstrap InnoDB Cluster ─────────────────────────────
    console.log('\n[4/6] Bootstrapping InnoDB Cluster...');
    for (const node of MYSQL_NODES) {
        await waitForMySQL(node);
    }

    console.log('  Creating InnoDB Cluster via MySQL Shell...');
    const mysqlshScript = `
try {
  var cluster = dba.getCluster('mcpCluster');
  print('Cluster already exists.\\n');
} catch (e) {
  print('Creating new cluster...\\n');
  var cluster = dba.createCluster('mcpCluster');
  
  print('Adding node 2...\\n');
  cluster.addInstance('root:root@mysql-node2:3306', { recoveryMethod: 'clone' });
  
  print('Adding node 3...\\n');
  cluster.addInstance('root:root@mysql-node3:3306', { recoveryMethod: 'clone' });
  
  print('Cluster bootstrap complete.\\n');
}
`;
    const initClusterPath = join(REPO_ROOT, 'scripts/init-cluster.js');
    fs.writeFileSync(initClusterPath, mysqlshScript);
    run('docker cp scripts/init-cluster.js mysql-node1:/tmp/init-cluster.js');
    fs.unlinkSync(initClusterPath); // Clean up the temporary scratch file
    run('docker exec mysql-node1 mysqlsh --user=root --password=root --host=127.0.0.1 --port=3306 -f /tmp/init-cluster.js');

    // ── Phase 4: Start remaining ecosystem ───────────────────────────
    console.log('\n[4.5/6] Starting remaining ecosystem containers...');
    run('docker compose up -d --build');

    // ── Phase 5: Verify cluster ──────────────────────────────────────
    console.log('\n[5/6] Verifying cluster status...');
    // Wait for cluster-healer to become healthy (confirms cluster is ONLINE)
    for (let i = 1; i <= 30; i++) {
        const health = runQuiet('docker inspect cluster-healer --format "{{.State.Health.Status}}"');
        if (health === 'healthy') {
            console.log('  ✅ Cluster healer reports healthy');
            break;
        }
        if (i === 30) console.log('  ⚠️ Cluster healer not yet healthy (cluster-healer will continue healing in background)');
        await setTimeout(5000);
    }

    // Verify via raw SQL (avoids mysqlsh stderr stall issues)
    const memberStatus = mysqlExec('mysql-node1',
        "SELECT CONCAT(member_host, '=', member_state) FROM performance_schema.replication_group_members ORDER BY member_host;");
    const onlineCount = (memberStatus.match(/ONLINE/g) || []).length;
    console.log(`  Cluster: ${onlineCount}/3 nodes ONLINE`);
    if (memberStatus) console.log(`  ${memberStatus.replace(/\n/g, ', ')}`);

    // Verify router and proxysql
    for (let i = 1; i <= 20; i++) {
        const routerHealth = runQuiet('docker inspect mysql-router --format "{{.State.Health.Status}}"');
        if (routerHealth === 'healthy') {
            console.log('  ✅ MySQL Router is healthy');
            break;
        }
        if (i === 20) console.log('  ⚠️ MySQL Router not yet healthy');
        await setTimeout(3000);
    }

    const proxysqlHealth = runQuiet('docker inspect proxysql --format "{{.State.Health.Status}}"');
    console.log(`  ProxySQL: ${proxysqlHealth}`);

    // ── Phase 6: Seed database ───────────────────────────────────────
    console.log('\n[6/6] Seeding the test database...');
    run('node scripts/reset-database.mjs --skip-verify');

    console.log('\n✅ Unified Database Ecosystem Successfully Recreated.');
} catch (error) {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
}

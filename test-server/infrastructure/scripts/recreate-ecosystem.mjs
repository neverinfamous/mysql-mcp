import { exec as execCallback, spawn } from 'child_process';
import { promisify } from 'util';
import { setTimeout } from 'timers/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const execAsync = promisify(execCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const adamicRoot = join(__dirname, '../../..');
const REPO_ROOT = join(__dirname, '..');
const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;

// Load secrets.env for DD_API_KEY and other environment variables
const secretsPath = join(adamicRoot, 'secrets.env');
if (existsSync(secretsPath)) {
    const envConfig = await fs.readFile(secretsPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?$/);
        if (match) {
            process.env[match[1]] = (match[2] || '').trim().replace(/^['"](.*?)['"]$/, '$1');
        }
    });
    process.env.WSLENV = process.env.WSLENV ? `${process.env.WSLENV}:DD_API_KEY/u` : 'DD_API_KEY/u';
}

const MYSQL_ROOT_PASSWORD = process.env.MYSQL_ROOT_PASSWORD || 'root';

// ── Helpers ──────────────────────────────────────────────────────────

function wsl(command) {
    return process.platform === 'win32' ? `wsl ${command}` : command;
}

async function run(command) {
    const cmd = wsl(command);
    console.log(`\n> ${cmd}`);
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, { shell: true, stdio: 'inherit', cwd: REPO_ROOT, env: process.env });
        child.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Command failed with exit code ${code}: ${cmd}`));
        });
        child.on('error', reject);
    });
}

async function runQuiet(command) {
    try {
        const { stdout } = await execAsync(wsl(command), { encoding: 'utf-8', cwd: REPO_ROOT, env: process.env });
        return stdout.trim();
    } catch {
        return '';
    }
}

async function exec(cmd, ignoreError = false) {
    try {
        const { stdout } = await execAsync(wsl(cmd), { encoding: 'utf-8', env: process.env });
        return stdout;
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

async function mysqlExec(container, query) {
    return (await exec(`docker exec -e MYSQL_PWD=${MYSQL_ROOT_PASSWORD} ${container} mysql -uroot -N -s -e "${query}"`, true)) || '';
}

async function waitForMySQL(containerName) {
    console.log(`  Waiting for MySQL in ${containerName}...`);
    for (let i = 1; i <= MAX_RETRIES; i++) {
        const out = await exec(`docker exec -e MYSQL_PWD=${MYSQL_ROOT_PASSWORD} ${containerName} mysqladmin ping -h 127.0.0.1 -uroot`, true);
        if (out && out.includes('mysqld is alive')) {
            console.log(`  ✅ ${containerName} is ready`);
            return;
        }
        if (i % 10 === 0) console.log(`  Still waiting for ${containerName}... (${i}/${MAX_RETRIES})`);
        await setTimeout(RETRY_DELAY_MS);
    }
    throw new Error(`Timeout waiting for ${containerName} to become ready.`);
}

async function runMySQLShellScript(container, scriptContent) {
    const cmd = wsl(`docker exec -i ${container} mysqlsh --js --user=root --password=${MYSQL_ROOT_PASSWORD} --host=127.0.0.1 --port=3306`);
    return new Promise((resolve, reject) => {
        const child = spawn(cmd, { shell: true, stdio: ['pipe', 'inherit', 'pipe'], cwd: REPO_ROOT, env: process.env });
        child.stdin.write(scriptContent);
        child.stdin.end();

        let stderrBuffer = '';
        child.stderr.on('data', data => {
            stderrBuffer += data.toString();
            let lines = stderrBuffer.split('\n');
            stderrBuffer = lines.pop(); // Keep the last incomplete line
            for (const line of lines) {
                if (line.includes('Cannot set LC_ALL')) continue;
                if (line.includes('Using a password on the command line interface can be insecure')) continue;
                console.error(line);
            }
        });

        child.on('close', code => {
            if (stderrBuffer) {
                if (!stderrBuffer.includes('Cannot set LC_ALL') && !stderrBuffer.includes('Using a password')) {
                    process.stderr.write(stderrBuffer);
                }
            }
            if (code === 0) resolve();
            else reject(new Error(`MySQL Shell script failed on ${container}`));
        });
        child.on('error', reject);
    });
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Recreating Unified Database Ecosystem (Optimized) ===');

    let servicesRaw;
    try {
        const { stdout } = await execAsync(wsl('docker compose config --services'), { encoding: 'utf-8', cwd: REPO_ROOT });
        servicesRaw = stdout.trim();
    } catch (e) {
        if (e.stdout && e.stdout.trim()) {
            servicesRaw = e.stdout.trim();
        } else {
            console.log('  ⚠️  docker compose config failed, falling back to YAML parsing...');
            const yamlContent = await fs.readFile(join(REPO_ROOT, 'docker-compose.yml'), 'utf-8');
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
        throw new Error('Error: No mysql-node services found in docker-compose.yml');
    }
    const MYSQL_VOLUMES = [
        ...MYSQL_NODES.map(n => `infrastructure_${n}-data-v4`),
        'infrastructure_mysql-async-replica-data-v4'
    ];

    // ── Phase 0: Network setup ───────────────────────────────────────
    console.log('\n[0/6] Configuring network...');
    try {
        const { stdout } = await execAsync('wsl bash -c "ip route show default | grep -oP \'(?<=default via )[0-9.]+\'"', { encoding: 'utf-8' });
        const wslGateway = stdout.trim();
        if (wslGateway) {
            const envPath = join(REPO_ROOT, '.env');
            let envContent = '';
            try { envContent = await fs.readFile(envPath, 'utf-8'); } catch {}
            const filteredLines = envContent.split('\n').filter(l => !l.startsWith('WINDOWS_HOST_IP=') && !l.startsWith('MYSQL_ROOT_PASSWORD='));
            filteredLines.push(`WINDOWS_HOST_IP=${wslGateway}`);
            filteredLines.push(`MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}`);
            await fs.writeFile(envPath, filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
            console.log(`  Windows Host IP: ${wslGateway}`);
        }
    } catch (e) {
        console.log(`  ⚠️ Could not detect WSL gateway IP: ${e.message}`);
    }

    // ── Phase 1: Aggressive cleanup ──────────────────────────────────
    console.log('\n[1/6] Discovering services...');
    const services = servicesRaw.split('\n').filter(Boolean).sort();
    if (services.length === 0) {
        throw new Error('No services found in docker-compose.yml. Is the file valid?');
    }
    console.log(`  Found ${services.length} services: ${services.join(', ')}`);

    console.log('\n[2/6] Cleaning up containers, volumes, and networks...');
    await Promise.all(services.map(name => runQuiet(`docker rm -f ${name}`)));
    
    for (const vol of MYSQL_VOLUMES) {
        const orphans = await runQuiet(`docker ps -a --filter volume=${vol} -q`);
        if (orphans) {
            const orphanIds = orphans.split('\n').filter(Boolean);
            await Promise.all(orphanIds.map(async id => {
                console.log(`  Removing orphan container ${id} (holds volume ${vol})`);
                await runQuiet(`docker rm -f ${id}`);
            }));
        }
    }
    await setTimeout(2000); // Let Docker release volume locks

    await run('docker compose down -v --remove-orphans');
    await setTimeout(3000);

    for (const vol of MYSQL_VOLUMES) {
        for (let attempt = 0; attempt < 5; attempt++) {
            if (!(await runQuiet(`docker volume inspect ${vol}`))) break;
            console.log(`  Volume ${vol} still exists, retrying removal...`);
            await runQuiet(`docker volume rm -f ${vol}`);
            await setTimeout(2000);
        }
        if (await runQuiet(`docker volume inspect ${vol}`)) {
            throw new Error(`FATAL: Could not remove volume ${vol}. Please run 'docker volume rm ${vol}' manually.`);
        }
    }
    console.log('  ✅ All volumes confirmed removed');

    // ── Phase 2: Start MySQL nodes ───────────────────────────────────
    console.log('\n[3/6] Starting MySQL nodes...');
    await run('docker compose up -d mysql-node1 mysql-node2 mysql-node3 mysql-async-replica');

    // ── Phase 3: Bootstrap InnoDB Cluster ─────────────────────────────
    console.log('\n[4/6] Bootstrapping InnoDB Cluster...');
    await Promise.all(MYSQL_NODES.map(node => waitForMySQL(node)));

    console.log('  Creating InnoDB Cluster via MySQL Shell...');
    const mysqlshScript = `
var res = session.runSql("SELECT * FROM performance_schema.replication_group_members");
if (res.fetchAll().length > 0) {
  print('Cluster already exists.\\n');
} else {
  print('Creating new cluster...\\n');
  var cluster = dba.createCluster('mcpCluster');
  
  print('Adding node 2...\\n');
  cluster.addInstance('root:${MYSQL_ROOT_PASSWORD}@mysql-node2:3306', { recoveryMethod: 'clone' });
  
  print('Adding node 3...\\n');
  cluster.addInstance('root:${MYSQL_ROOT_PASSWORD}@mysql-node3:3306', { recoveryMethod: 'clone' });
  
  print('Cluster bootstrap complete.\\n');
}
`;
    await runMySQLShellScript('mysql-node1', mysqlshScript);

    // ── Phase 3.5: Bootstrap Async Replica ───────────────────────────
    console.log('\n[4.25/6] Bootstrapping Async Replica...');
    await waitForMySQL('mysql-async-replica');
    
    console.log('  Configuring asynchronous replication...');
    await mysqlExec('mysql-async-replica', `
        CHANGE REPLICATION SOURCE TO 
            SOURCE_HOST='mysql-node1', 
            SOURCE_USER='root', 
            SOURCE_PASSWORD='${MYSQL_ROOT_PASSWORD}', 
            SOURCE_AUTO_POSITION=1; 
        START REPLICA;
    `);
    console.log('  ✅ Async Replica is running');

    // ── Phase 4: Start remaining ecosystem ───────────────────────────
    console.log('\n[4.5/6] Starting remaining ecosystem containers...');
    await run('docker compose up -d --build');

    // ── Phase 5: Verify cluster ──────────────────────────────────────
    console.log('\n[5/6] Verifying cluster status...');
    
    // Concurrently wait for cluster-healer, router, and proxysql health
    const verifyHealer = async () => {
        for (let i = 1; i <= 30; i++) {
            const health = await runQuiet('docker inspect cluster-healer --format "{{.State.Health.Status}}"');
            if (health === 'healthy') {
                console.log('  ✅ Cluster healer reports healthy');
                return;
            }
            if (i === 30) console.log('  ⚠️ Cluster healer not yet healthy (cluster-healer will continue healing in background)');
            await setTimeout(5000);
        }
    };
    
    const verifyRouter = async () => {
        for (let i = 1; i <= 20; i++) {
            const routerHealth = await runQuiet('docker inspect mysql-router --format "{{.State.Health.Status}}"');
            if (routerHealth === 'healthy') {
                console.log('  ✅ MySQL Router is healthy');
                return;
            }
            if (i === 20) console.log('  ⚠️ MySQL Router not yet healthy');
            await setTimeout(3000);
        }
    };
    
    await Promise.all([verifyHealer(), verifyRouter()]);

    const memberStatus = await mysqlExec('mysql-node1',
        "SELECT CONCAT(member_host, '=', member_state) FROM performance_schema.replication_group_members ORDER BY member_host;");
    const onlineCount = (memberStatus.match(/ONLINE/g) || []).length;
    console.log(`  Cluster: ${onlineCount}/3 nodes ONLINE`);
    if (memberStatus) console.log(`  ${memberStatus.replace(/\n/g, ', ')}`);

    const proxysqlHealth = await runQuiet('docker inspect proxysql --format "{{.State.Health.Status}}"');
    console.log(`  ProxySQL: ${proxysqlHealth}`);

    // ── Phase 6: Seed database ───────────────────────────────────────
    console.log('\n[6/6] Seeding the test database...');
    await run('node scripts/reset-database.mjs --skip-verify');

    console.log('\n✅ Unified Database Ecosystem Successfully Recreated.');
}

main().catch(error => {
    console.error('\n❌ Ecosystem recreation failed:', error.message);
    process.exit(1);
});

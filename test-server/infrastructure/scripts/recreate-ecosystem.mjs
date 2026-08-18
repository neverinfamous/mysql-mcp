/**
 * Recreates the unified database ecosystem from scratch.
 *
 * Single lifecycle management script: dynamic container discovery, orphaned
 * container cleanup, teardown, startup, InnoDB Cluster bootstrap (with
 * retry/healing), group_seeds normalization, and database seeding.
 *
 * Non-interactive by design (agent-optimized).
 *
 * @see {@link ../AGENT_README.md} for full architecture documentation.
 */

import { spawn, execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { join } from 'path';
import fs from 'fs/promises';
import {
    resolveScriptPaths,
    detectDocker,
    loadSecrets,
    retry,
    registerWslKeepalive,
} from './utils.mjs';

const execAsync = promisify(execCallback);
const execFileAsync = promisify(execFileCallback);

// ── Configuration ────────────────────────────────────────────────────
// All magic values centralized here (modeled after check-status.mjs CONFIG).

const CONFIG = {
    retries: {
        mysql: 60,
        healer: 30,
        router: 20,
        volume: 5,
    },
    delays: {
        mysqlMs: 2000,
        healerMs: 5000,
        routerMs: 3000,
    },
    cluster: {
        name: 'mcpCluster',
        mysqlPort: 3306,
        grPort: 3306,
    },
    volume: {
        prefix: 'infrastructure_',
        suffix: '-data-v4',
    },
    services: {
        asyncReplica: 'mysql-async-replica',
    },
};

/**
 * Stderr noise patterns to suppress from MySQL Shell output.
 * Used in `runMySQLShellScript` to filter known-harmless warnings.
 */
const STDERR_NOISE = [
    'Cannot set LC_ALL',
    'Using a password on the command line interface can be insecure',
];

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
    console.log('=== Recreating Unified Database Ecosystem (Optimized) ===');

    // ── Setup: paths, secrets, Docker detection ──────────────────────
    const { ecosystemRoot, adamicRoot } = resolveScriptPaths(import.meta.url);
    const REPO_ROOT = ecosystemRoot;
    const MYSQL_ROOT_PASSWORD = await loadSecrets(adamicRoot);
    const { dockerCmd } = detectDocker();

    // Build a wsl()-equivalent that works with the string-based spawn API
    // needed for `docker compose` compound commands.
    const wslPrefix = dockerCmd === 'wsl' ? 'wsl ' : '';

    // ── Preflight: Ensure WSL keepalive is registered ────────────────
    // Prevents Windows from terminating WSL (and Docker) mid-recreate.
    // Idempotent — safe to call on every run. Only needed on Windows.
    try {
            const keepaliveOut = registerWslKeepalive(process.env.LOCALAPPDATA);
            const state = keepaliveOut.match(/Task state:\s*(\S+)/)?.[1] || 'unknown';
            console.log(`[Phase 0] WSL KeepAlive state: ${state}`);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`  ⚠️ WSL keepalive registration failed (non-fatal): ${msg}`);
    }

    /**
     * Run a Docker command with inherited stdio (visible output).
     * @param {string} command - The Docker command string.
     */
    async function run(command) {
        const cmd = command.startsWith('docker ') ? wslPrefix + command : command;
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

    /**
     * Run a Docker command quietly, returning trimmed stdout.
     * @param {string} command - The Docker command string.
     * @returns {Promise<string>} Trimmed stdout, or `''` on error.
     */
    async function runQuiet(command, extraEnv = {}) {
        const cmd = command.startsWith('docker ') ? wslPrefix + command : command;
        try {
            const { stdout } = await execAsync(cmd, { encoding: 'utf-8', cwd: REPO_ROOT, env: { ...process.env, ...extraEnv } });
            return stdout.trim();
        } catch {
            return '';
        }
    }

    /**
     * Execute a MySQL query inside a container via `mysql` CLI.
     * Uses `MYSQL_PWD` env var to avoid password on the command line.
     *
     * @param {string} container - Docker container name.
     * @param {string} query - SQL query string.
     * @returns {Promise<string>} Query output, or `''` on error.
     */
    async function mysqlExec(container, query) {
        const bin = dockerCmd === 'wsl' ? 'wsl' : 'docker';
        const args = ['exec', '-e', 'MYSQL_PWD', container, 'mysql', '-uroot', '-N', '-s', '-e', query];
        if (dockerCmd === 'wsl') args.unshift('docker');

        try {
            const { stdout } = await execFileAsync(bin, args, {
                encoding: 'utf-8',
                cwd: REPO_ROOT,
                env: {
                    ...process.env,
                    MYSQL_PWD: MYSQL_ROOT_PASSWORD,
                    WSLENV: (process.env.WSLENV ? process.env.WSLENV + ':' : '') + 'MYSQL_PWD/u'
                }
            });
            return (stdout || '').trim();
        } catch {
            return '';
        }
    }

    /**
     * Wait for a MySQL container to respond to `mysqladmin ping`.
     * @param {string} containerName - Docker container name.
     */
    async function waitForMySQL(containerName) {
        console.log(`  Waiting for MySQL in ${containerName}...`);
        const success = await retry(
            async (attempt) => {
                const cmd = `docker exec -e MYSQL_PWD ${containerName} mysqladmin ping -h 127.0.0.1 -uroot`;
                const out = await runQuiet(cmd, { MYSQL_PWD: MYSQL_ROOT_PASSWORD, WSLENV: (process.env.WSLENV ? process.env.WSLENV + ':' : '') + 'MYSQL_PWD/u' });
                if (out.includes('mysqld is alive')) {
                    console.log(`  ✅ ${containerName} is ready`);
                    return true;
                }
                if (attempt % 10 === 0) console.log(`  Still waiting for ${containerName}... (${attempt}/${CONFIG.retries.mysql})`);
                return false;
            },
            { maxAttempts: CONFIG.retries.mysql, delayMs: CONFIG.delays.mysqlMs },
        );
        if (!success) throw new Error(`Timeout waiting for ${containerName} to become ready.`);
    }

    /**
     * Wait for a Docker container's healthcheck to report `healthy`.
     *
     * @param {string} container - Docker container name.
     * @param {object} opts - Options.
     * @param {number} opts.maxRetries - Maximum poll attempts.
     * @param {number} opts.delayMs - Delay between polls.
     * @param {string} opts.label - Human-readable label for logging.
     * @param {boolean} [opts.required=false] - If true, throw on timeout. If false, log a warning.
     */
    async function waitForHealthy(container, { maxRetries, delayMs, label, required = false }) {
        const success = await retry(
            async () => {
                const health = await runQuiet(`docker inspect ${container} --format "{{.State.Health.Status}}"`);
                if (health === 'healthy') {
                    console.log(`  ✅ ${label} is healthy`);
                    return true;
                }
                return false;
            },
            { maxAttempts: maxRetries, delayMs },
        );
        if (!success) {
            const msg = `${label} not yet healthy`;
            if (required) throw new Error(msg);
            console.log(`  ⚠️ ${msg} (will continue healing in background)`);
        }
    }

    /**
     * Run a MySQL Shell JS script inside a container.
     * NOTE: mysqlsh does NOT read the MYSQL_PWD env var (only the mysql CLI does),
     * so --password= is required here despite being visible in `ps aux`.
     *
     * @param {string} container - Docker container name.
     * @param {string} scriptContent - MySQL Shell JavaScript to execute.
     */
    async function runMySQLShellScript(container, scriptContent) {
        const bin = dockerCmd === 'wsl' ? 'wsl' : 'docker';
        const args = ['exec', '-i', container, 'mysqlsh', '--js', '--user=root', `--password=${MYSQL_ROOT_PASSWORD}`, '--host=127.0.0.1', `--port=${CONFIG.cluster.mysqlPort}`];
        if (dockerCmd === 'wsl') args.unshift('docker');
        
        return new Promise((resolve, reject) => {
            const child = spawn(bin, args, { stdio: ['pipe', 'inherit', 'pipe'], cwd: REPO_ROOT, env: process.env });
            child.stdin.write(scriptContent);
            child.stdin.end();

            // Process stderr line-by-line, filtering known noise.
            // Uses per-chunk processing to avoid quadratic buffer growth.
            let remainder = '';
            child.stderr.on('data', data => {
                const str = remainder + data.toString();
                const lines = str.split('\n');
                remainder = lines.pop() || '';
                for (const line of lines) {
                    if (STDERR_NOISE.some(noise => line.includes(noise))) continue;
                    if (line.trim()) process.stderr.write(line + '\n');
                }
            });

            child.on('close', code => {
                // Flush remainder
                if (remainder.trim() && !STDERR_NOISE.some(noise => remainder.includes(noise))) {
                    process.stderr.write(remainder + '\n');
                }
                if (code === 0) resolve();
                else reject(new Error(`MySQL Shell script failed on ${container}`));
            });
            child.on('error', reject);
        });
    }

    // ── Phase timing utility ─────────────────────────────────────────
    const phaseStart = () => performance.now();
    const phaseEnd = (phase, start) => {
        const elapsed = ((performance.now() - start) / 1000).toFixed(1);
        console.log(`  ⏱️  Phase ${phase} completed in ${elapsed}s`);
    };

    // ── Phase 1/9: Network setup ─────────────────────────────────────
    let t = phaseStart();
    console.log('\n[1/9] Configuring network...');
    try {
        // Detect WSL gateway IP for Windows host communication.
        // This uses bash directly since it's a Linux-specific command.
        const bashPrefix = dockerCmd === 'wsl' ? 'wsl ' : '';
        const { stdout } = await execAsync(`${bashPrefix}bash -c "ip route show default | grep -oP '(?<=default via )[0-9.]+'"`, { encoding: 'utf-8' });
        const wslGateway = stdout.trim();
        if (wslGateway) {
            const envPath = join(REPO_ROOT, '.env');
            let envContent = '';
            try { envContent = await fs.readFile(envPath, 'utf-8'); } catch { /* file may not exist */ }
            const filteredLines = envContent.split(/\r?\n/).filter(l => !l.startsWith('WINDOWS_HOST_IP=') && !l.startsWith('MYSQL_ROOT_PASSWORD='));
            filteredLines.push(`WINDOWS_HOST_IP=${wslGateway}`);
            filteredLines.push(`MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}`);
            await fs.writeFile(envPath, filteredLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n');
            console.log(`  Windows Host IP: ${wslGateway}`);
        }
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.log(`  ⚠️ Could not detect WSL gateway IP: ${msg}`);
    }
    phaseEnd('1/9', t);

    // ── Phase 2/9: Discover services ─────────────────────────────────
    t = phaseStart();
    console.log('\n[2/9] Discovering services...');
    let servicesRaw;
    try {
        const { stdout } = await execAsync(wslPrefix + 'docker compose config --services', { encoding: 'utf-8', cwd: REPO_ROOT });
        servicesRaw = stdout.trim();
    } catch (e) {
        if (e.stdout && e.stdout.trim() && e.stdout.includes('mysql-node')) {
            servicesRaw = e.stdout.trim();
        } else {
            console.error('  ⚠️  docker compose config failed. Are you in the infrastructure directory, or is Docker daemon down?');
            throw e;
        }
    }

    // Parse services once, derive MYSQL_NODES from the shared array.
    const services = servicesRaw.split('\n').filter(Boolean).sort();
    if (services.length === 0) {
        throw new Error('No services found in docker-compose.yml. Is the file valid?');
    }
    const MYSQL_NODES = services.filter(s => s.startsWith('mysql-node')).sort();
    if (MYSQL_NODES.length === 0) {
        throw new Error('Error: No mysql-node services found in docker-compose.yml');
    }
    // Discover async replica dynamically (fallback to CONFIG default)
    const ASYNC_REPLICA = services.find(s => s.includes('async-replica')) || CONFIG.services.asyncReplica;
    const MYSQL_VOLUMES = [
        ...MYSQL_NODES.map(n => `${CONFIG.volume.prefix}${n}${CONFIG.volume.suffix}`),
        `${CONFIG.volume.prefix}${ASYNC_REPLICA}${CONFIG.volume.suffix}`,
    ];

    console.log(`  Found ${services.length} services: ${services.join(', ')}`);
    phaseEnd('2/9', t);

    // ── Phase 3/9: Aggressive cleanup ────────────────────────────────
    t = phaseStart();
    console.log('\n[3/9] Cleaning up containers, volumes, and networks...');

    // Remove all known service containers in parallel
    await Promise.all(services.map(name => runQuiet(`docker rm -f ${name}`)));

    // Discover and remove orphan containers holding volumes — in parallel
    await Promise.all(MYSQL_VOLUMES.map(async vol => {
        const orphans = await runQuiet(`docker ps -a --filter volume=${vol} -q`);
        if (orphans) {
            const orphanIds = orphans.split('\n').filter(Boolean);
            await Promise.all(orphanIds.map(async id => {
                console.log(`  Removing orphan container ${id} (holds volume ${vol})`);
                await runQuiet(`docker rm -f ${id}`);
            }));
        }
    }));

    await run('docker compose down -v --remove-orphans');

    // Retry volume removal in parallel (PERF-1: ~50s wall-clock savings)
    await Promise.all(MYSQL_VOLUMES.map(async vol => {
        const removed = await retry(
            async () => !(await runQuiet(`docker volume inspect ${vol}`)),
            {
                maxAttempts: CONFIG.retries.volume,
                delayMs: CONFIG.delays.mysqlMs,
                onRetry: () => {
                    console.log(`  Volume ${vol} still exists, retrying removal...`);
                    runQuiet(`docker volume rm -f ${vol}`);
                },
            },
        );
        if (!removed) {
            throw new Error(`FATAL: Could not remove volume ${vol}. Please run 'docker volume rm ${vol}' manually.`);
        }
    }));
    console.log('  ✅ All volumes confirmed removed');
    phaseEnd('3/9', t);

    // ── Phase 4/9: Start MySQL nodes ─────────────────────────────────
    t = phaseStart();
    console.log('\n[4/9] Starting MySQL nodes...');
    // Use dynamically-discovered node names instead of hardcoded values
    await run(`docker compose up -d ${MYSQL_NODES.join(' ')} ${ASYNC_REPLICA}`);
    phaseEnd('4/9', t);

    // ── Phase 5/9: Bootstrap InnoDB Cluster ──────────────────────────
    t = phaseStart();
    console.log('\n[5/9] Bootstrapping InnoDB Cluster...');

    // Preflight: warm up mysqlsh JIT in parallel with MySQL health-waits
    const mysqlshPreflight = runQuiet(`docker exec ${MYSQL_NODES[0]} mysqlsh --version`).catch(() => {});

    // Wait for all nodes AND async replica concurrently (PERF-3)
    await Promise.all([
        ...MYSQL_NODES.map(node => waitForMySQL(node)),
        waitForMySQL(ASYNC_REPLICA),
        mysqlshPreflight,
    ]);

    console.log('  Creating InnoDB Cluster via MySQL Shell...');
    const mysqlshScript = `
var res = session.runSql("SELECT COUNT(*) AS cnt FROM performance_schema.replication_group_members");
var row = res.fetchOne();
if (row[0] > 0) {
  print('Cluster already exists.\\n');
} else {
  print('Creating new cluster...\\n');
  var cluster = dba.createCluster('${CONFIG.cluster.name}');
  ${MYSQL_NODES.slice(1).map((node, i) => `
  print('Adding node ${i + 2}...\\n');
  cluster.addInstance('root:${MYSQL_ROOT_PASSWORD}@${node}:${CONFIG.cluster.mysqlPort}', { recoveryMethod: 'clone' });`).join('\n')}
  
  print('Cluster bootstrap complete.\\n');
}
`;
    await runMySQLShellScript(MYSQL_NODES[0], mysqlshScript);
    phaseEnd('5/9', t);

    // ── Phase 6/9: Normalize Group Replication settings ──────────────
    t = phaseStart();
    console.log('\n[6/9] Normalizing group_seeds and ip_allowlist...');
    const allSeeds = MYSQL_NODES.map(n => `${n}:${CONFIG.cluster.grPort}`).join(',');
    await Promise.all(MYSQL_NODES.map(node =>
        mysqlExec(node,
            `SET GLOBAL group_replication_ip_allowlist='AUTOMATIC'; SET PERSIST group_replication_group_seeds='${allSeeds}';`,
        ),
    ));
    console.log(`  group_seeds: ${allSeeds}`);
    console.log('  ip_allowlist: AUTOMATIC');
    console.log('  ✅ GR settings normalized across all nodes');
    phaseEnd('6/9', t);

    // ── Phase 7/9: Bootstrap Async Replica ───────────────────────────
    t = phaseStart();
    console.log('\n[7/9] Bootstrapping Async Replica...');
    // Async replica health-wait already completed in Phase 5
    console.log('  Configuring asynchronous replication...');
    await mysqlExec(ASYNC_REPLICA,
        `CHANGE REPLICATION SOURCE TO SOURCE_HOST='${MYSQL_NODES[0]}', SOURCE_USER='root', SOURCE_PASSWORD='${MYSQL_ROOT_PASSWORD}', SOURCE_AUTO_POSITION=1; START REPLICA; SET PERSIST super_read_only=ON;`,
    );
    console.log('  ✅ Async Replica is running (super_read_only=ON)');
    phaseEnd('7/9', t);

    // ── Phase 8/9: Start remaining ecosystem ─────────────────────────
    t = phaseStart();
    console.log('\n[8/9] Starting remaining ecosystem containers...');
    await run('docker compose up -d --build');

    // Verify cluster health + infrastructure health concurrently
    console.log('\n  Verifying cluster and infrastructure health...');
    await Promise.all([
        waitForHealthy('cluster-healer', {
            maxRetries: CONFIG.retries.healer,
            delayMs: CONFIG.delays.healerMs,
            label: 'Cluster healer',
        }),
        waitForHealthy('mysql-router', {
            maxRetries: CONFIG.retries.router,
            delayMs: CONFIG.delays.routerMs,
            label: 'MySQL Router',
        }),
        waitForHealthy('proxysql', {
            maxRetries: 30,
            delayMs: 2000,
            label: 'ProxySQL',
        })
    ]);

    console.log('  Waiting for InnoDB Cluster to reach full ONLINE quorum...');
    let memberStatus = '';
    const clusterReady = await retry(
        async (attempt) => {
            memberStatus = await mysqlExec(MYSQL_NODES[0], "SELECT CONCAT(member_host, '=', member_state) FROM performance_schema.replication_group_members ORDER BY member_host;");
            const onlineCount = (memberStatus.match(/ONLINE/g) || []).length;
            if (onlineCount === MYSQL_NODES.length) return true;
            if (attempt % 5 === 0) console.log(`  Still waiting for Cluster... (${onlineCount}/${MYSQL_NODES.length} ONLINE)`);
            return false;
        },
        { maxAttempts: 30, delayMs: 2000 }
    );
    
    if (!clusterReady) {
        throw new Error(`Cluster failed to reach full quorum.\n  Status: ${memberStatus.replace(/\n/g, ', ')}`);
    }
    console.log(`  ✅ Cluster is fully ONLINE (${MYSQL_NODES.length}/${MYSQL_NODES.length} nodes)`);
    phaseEnd('8/9', t);

    // ── Phase 9/9: Seed database ─────────────────────────────────────
    t = phaseStart();
    console.log('\n[9/9] Seeding the test database...');
    await run('node scripts/reset-database.mjs --skip-verify');
    phaseEnd('9/9', t);

    console.log('\n✅ Unified Database Ecosystem Successfully Recreated.');
}

main().catch(error => {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('\n❌ Ecosystem recreation failed:', msg);
    process.exit(1);
});

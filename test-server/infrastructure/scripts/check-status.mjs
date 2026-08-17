import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectDocker } from './utils.mjs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Resolves to docs/unified-database-ecosystem/ (the infra root, not the repo root)
const ECOSYSTEM_ROOT = path.resolve(__dirname, '..');

// ============================================================
// Configuration — all magic values centralized here
// ============================================================
const CONFIG = {
    credentials: {
        mysql: { user: 'root', password: process.env.MYSQL_ROOT_PASSWORD || 'root' },
        proxyAdmin: { user: 'radmin', password: 'radmin' },
        proxyData: { user: 'cluster_admin', password: 'cluster_admin' },
        routerApi: { user: 'rest_api', password: 'router_api' },
    },
    cluster: { name: 'mcpCluster' },
    database: 'testdb',
    routerApiPath: '/api/20190715/router/status',
    routerApiResponseKey: 'processId',
    metricsPrefix: 'mysql_mcp_',
    ports: {
        routerRW: '6446',
        routerRO: '6447',
        routerAPI: '8443',
        proxySQLAdmin: '6032',
        proxySQLData: '6033',
        mcpExporter: '3000',
        prometheus: '9090',
        grafana: '3000',
        loki: '3100',
        alloy: '12345',
    },
    timeouts: {
        curlSec: '5',
        routerHttpCheckSec: '2',
    },
    redis: {
        healthKey: 'healthcheck:test',
        healthValue: 'ok',
        healthTtlSec: '10',
    },
    workspace: {
        mcpPackageJson: '/workspace/mysql-mcp/package.json',
        scratchDir: '/workspace/scratch',
    },
    expectedTables: {
        test_products:     16,
        test_orders:       20,
        test_json_docs:    8,
        test_articles:     10,
        test_users:        10,
        test_measurements: 200,
        test_locations:    15,
        test_categories:   17,
        test_events:       100,
        test_documents:    10,
        test_partitioned:  26,
        temp_write_test:   5,
    },
};

const MYSQL_PWD_ENV = `MYSQL_PWD=${CONFIG.credentials.mysql.password}`;
const MYSQL_USER_FLAG = `-u${CONFIG.credentials.mysql.user}`;

// ============================================================
// Helpers
// ============================================================

/** Split string by newlines, handling both LF and CRLF (WSL boundary safety) */
const splitLines = (str) => str.split(/\r?\n/);

/** Safely parse JSON, returning { ok, data } instead of throwing */
const safeParse = (raw) => {
    try { return { ok: true, data: JSON.parse(raw) }; }
    catch { return { ok: false, data: null }; }
};

/** Strip leading MySQL warning lines, returning the last meaningful line */
const stripMysqlWarning = (val) => {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed.includes('mysql: [Warning]')) return trimmed;
    return splitLines(trimmed).filter(l => !l.startsWith('mysql: [Warning]')).pop()?.trim() ?? trimmed;
};

/** Extract the value from a settled Promise.allSettled result, or null if rejected */
const settled = (result) => result.status === 'fulfilled' ? result.value : null;

// Cached env object — avoids re-spreading process.env (100+ keys) on every subprocess call
const EXEC_ENV = Object.freeze({ ...process.env, LC_ALL: 'C', LANG: 'C' });

/** Synchronous command execution with optional error suppression */
const execCommand = (cmd, args, ignoreError = false) => {
    try {
        return execFileSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe', cwd: ECOSYSTEM_ROOT, env: EXEC_ENV });
    } catch (e) {
        if (!ignoreError) {
            console.error(`Error: ${e.message}`);
        }
        return null;
    }
};

/** Async command execution (promise-based) with error suppression */
const execCommandAsync = async (cmd, args) => {
    try {
        const { stdout } = await execFileAsync(cmd, args, { encoding: 'utf-8', cwd: ECOSYSTEM_ROOT, env: EXEC_ENV });
        return stdout;
    } catch {
        return null;
    }
};

// ── Docker detection ────────────────────────────────────────
const { dockerCmd, dockerBaseArgs } = detectDocker();
const dockerArgs = [...dockerBaseArgs, 'compose'];

let servicesRaw = execCommand(dockerCmd, [...dockerArgs, 'config', '--services'], true);

let containers = [];
if (servicesRaw) {
    containers = splitLines(servicesRaw.trim()).filter(Boolean).sort();
} else {
    console.error('Failed to run docker compose config to get services. Are you in the infrastructure directory, or is Docker daemon down?');
    process.exit(1);
}

/** Build the argument list for a `docker exec` call */
const buildDockerExecArgs = (container, envPairs, cmdArgs) => {
    const envArgs = envPairs.flatMap(pair => ['-e', pair]);
    return dockerCmd === 'wsl'
        ? ['docker', 'exec', ...envArgs, container, ...cmdArgs]
        : ['exec', ...envArgs, container, ...cmdArgs];
};

// Helper: run a command inside a Docker container (sync)
const dockerExec = (container, cmdArgs, ignoreError = true) =>
    dockerExecEnv(container, [], cmdArgs, ignoreError);

// Helper: run a command inside a Docker container with env vars (sync)
const dockerExecEnv = (container, envPairs, cmdArgs, ignoreError = true) =>
    execCommand(dockerCmd, buildDockerExecArgs(container, envPairs, cmdArgs), ignoreError);

// Helper: async docker exec (for parallel sections)
const dockerExecAsync = async (container, cmdArgs) =>
    dockerExecEnvAsync(container, [], cmdArgs);

// Helper: async docker exec with env vars (for parallel sections)
const dockerExecEnvAsync = async (container, envPairs, cmdArgs) =>
    execCommandAsync(dockerCmd, buildDockerExecArgs(container, envPairs, cmdArgs));

const SEPARATOR = '----------------------------------------';

console.log('=== Ecosystem Status Check ===\n');

// Sections set this to false on any failure; checked at the final summary.
let allUp = true;
// Populated by Section 1, consumed by Section 6
let runningContainers = {};

// Removed host-level mysqlsh availability check.

// Preflight: fire the mysqlsh cluster metadata check concurrently.
// This overlaps the heavy mysqlsh-inside-docker startup with Sections 1-2.
const mysqlNodes = containers.filter(c => c.startsWith('mysql-node'));
const firstMysqlNode = mysqlNodes[0] ?? null;
const mysqlRouterNode = containers.find(c => c.includes('mysql-router')) || 'mysql-router';
const datadogUnifiedNode = containers.find(c => c.includes('datadog-unified')) || 'datadog-unified';
const prometheusNode = containers.find(c => c.includes('prometheus')) || 'prometheus';
const asyncReplicaNode = containers.find(c => c.includes('mysql-async-replica')) || 'mysql-async-replica';
const mysqlshMetadataPromise = firstMysqlNode
    ? dockerExecEnvAsync(firstMysqlNode, [], ['mysqlsh', `--user=${CONFIG.credentials.mysql.user}`, `--password=${CONFIG.credentials.mysql.password}`, '--host=127.0.0.1', '--port=3306', '--js', '-e', `try { var c = dba.getCluster('${CONFIG.cluster.name}'); print('OK'); } catch(e) { print('ERROR: ' + e.message); process.exit(1); }`])
    : Promise.resolve(null);

/** Run a named section with error boundary to prevent cascading failures */
const runSection = (name, fn) => {
    try {
        fn();
    } catch (err) {
        console.error(`❌ Section "${name}" crashed: ${err.message}`);
        allUp = false;
    }
};

/** Run an async named section with error boundary */
const runSectionAsync = async (name, fn) => {
    try {
        await fn();
    } catch (err) {
        console.error(`❌ Section "${name}" crashed: ${err.message}`);
        allUp = false;
    }
};

// ============================================================
// Section 1: Container Status
// ============================================================
runSection('Container Status', () => {
    console.log(`1. Container Status (${containers.length} services):`);
    console.log(SEPARATOR);

    const psOutput = execCommand(dockerCmd, dockerCmd === 'wsl' ? ['docker', 'ps', '-a', '--format', '{{.Names}}\t{{.State}}\t{{.Status}}'] : ['ps', '-a', '--format', '{{.Names}}\t{{.State}}\t{{.Status}}'], false);
    if (!psOutput) {
        console.error(`Error: Failed to execute docker ps. Docker daemon might not be running.`);
        process.exit(1);
    }

    const runningContainersMap = {};
    for (const line of splitLines(psOutput.trim()).filter(Boolean)) {
        const parts = line.split('\t');
        if (parts.length < 3) continue;
        const [name, state, status] = parts;
        if (name) {
            runningContainersMap[name] = { state, status };
        }
    }
    runningContainers = runningContainersMap;

    for (const name of containers) {
        const info = runningContainers[name];
        if (info) {
            let displayStatus = info.status;
            let icon = '✅';
            if (info.state !== 'running') {
                icon = '❌';
                displayStatus = `Down (${info.state})`;
                allUp = false;
            } else if (info.status.includes('unhealthy')) {
                icon = '⚠️';
                allUp = false;
            } else if (info.status.includes('health: starting')) {
                icon = '⏳';
                allUp = false;
            }
            console.log(`${icon} ${name.padEnd(20)} : ${displayStatus}`);
        } else {
            console.log(`❌ ${name.padEnd(20)} : Not Found / Offline`);
            allUp = false;
        }
    }
});

// ============================================================
// Section 2: InnoDB Cluster Status
// ============================================================
runSection('InnoDB Cluster Status', () => {
    console.log('\n2. InnoDB Cluster Status:');
    console.log(SEPARATOR);

    let clusterOut = null;
    let primaryOut = null;

    for (const node of mysqlNodes) {
        clusterOut = dockerExecEnv(node, [MYSQL_PWD_ENV], ['mysql', MYSQL_USER_FLAG, '-e', 'SELECT member_state FROM performance_schema.replication_group_members;'], true);
        if (clusterOut !== null) {
            primaryOut = dockerExecEnv(node, [MYSQL_PWD_ENV], ['mysql', MYSQL_USER_FLAG, '-N', '-s', '-e', "SELECT member_host FROM performance_schema.replication_group_members WHERE member_role='PRIMARY';"], true);
            break;
        }
    }

    if (clusterOut !== null) {
        // Check how many are ONLINE
        const onlineCount = (clusterOut.match(/ONLINE/g) || []).length;
        const currentPrimary = primaryOut ? primaryOut.trim() : 'Unknown';
        const targetQuorum = mysqlNodes.length > 0 ? mysqlNodes.length : 3;
        if (onlineCount >= targetQuorum) {
            console.log(`✅ Cluster Quorum is ONLINE (${onlineCount}/${targetQuorum} nodes)`);
            console.log(`   👑 Current Primary: ${currentPrimary}`);
            if (currentPrimary && currentPrimary !== 'Unknown') {
                const primaryHostName = currentPrimary.split(':')[0];
                const readOnlyCheck = dockerExecEnv(primaryHostName, [MYSQL_PWD_ENV], ['mysql', MYSQL_USER_FLAG, '-N', '-s', '-e', 'SELECT @@super_read_only;'], true);
                const readOnlyVal = stripMysqlWarning(readOnlyCheck);
                if (readOnlyVal === '1') {
                    console.log(`   ❌ PRIMARY IS STUCK IN READ-ONLY MODE (super_read_only=1)`);
                    console.log(`   🛠️  Run: node scripts/heal-primary.mjs`);
                    allUp = false;
                }
            }
        } else {
            console.log(`⚠️ Cluster Quorum is DEGRADED. Only ${onlineCount}/${targetQuorum} nodes ONLINE.\nDetails:\n${clusterOut.replace(/mysql: \[Warning\].*\n/g, '').trim()}`);
            console.log(`   👑 Current Primary: ${currentPrimary}`);
            allUp = false;
        }
    } else {
        console.log('❌ Failed to retrieve cluster status from any MySQL node.');
        allUp = false;
    }
});

// ============================================================
// Section 2.5: Async Replica Status
// ============================================================
runSection('Async Replica Status', () => {
    if (containers.includes(asyncReplicaNode)) {
        console.log('\n2.5. Async Replica Status:');
        console.log(SEPARATOR);
        const replicaOut = dockerExecEnv(asyncReplicaNode, [MYSQL_PWD_ENV], ['mysql', MYSQL_USER_FLAG, '-E', '-e', 'SHOW REPLICA STATUS'], true);
        if (replicaOut && replicaOut.includes('Replica_IO_Running: Yes') && replicaOut.includes('Replica_SQL_Running: Yes')) {
            console.log('✅ Async Replica        : IO and SQL threads are running');
        } else {
            console.log('❌ Async Replica        : Replication is not running properly');
            if (replicaOut) {
                console.log(splitLines(replicaOut).filter(l => l.includes('Running:') || l.includes('Error')).join('\n'));
            }
            allUp = false;
        }
    }
});

// ============================================================
// Section 3: MySQL Shell Metadata Verification (pre-warmed by preflight promise)
// ============================================================
await runSectionAsync('MySQL Shell Metadata Verification', async () => {
    console.log('\n3. MySQL Shell Metadata Verification:');
    console.log(SEPARATOR);
    if (mysqlNodes.length > 0) {
        const shellOut = await mysqlshMetadataPromise;

        if (shellOut && shellOut.includes('OK')) {
            console.log(`✅ mysqlsh successfully read InnoDB Cluster metadata ('${CONFIG.cluster.name}')`);
        } else {
            console.log(`❌ mysqlsh could not verify cluster metadata`);
            if (shellOut) {
                const errLine = splitLines(shellOut).find(l => l.includes('ERROR') || l.includes('Exception'));
                console.log(`   ${errLine || splitLines(shellOut.trim()).pop()}`);
            }
            allUp = false;
        }
    } else {
        console.log(`❌ No mysql nodes found to execute mysqlsh`);
        allUp = false;
    }
});

// ============================================================
// Section 4: Routing & Proxy Data-Plane Validation (Parallel)
// ============================================================
await runSectionAsync('Routing & Proxy Validation', async () => {
    console.log('\n4. Routing & Proxy Validation:');
    console.log(SEPARATOR);

    const { routerRW, routerRO, routerAPI, proxySQLAdmin, proxySQLData } = CONFIG.ports;
    const { proxyAdmin, proxyData, routerApi } = CONFIG.credentials;
    const { routerHttpCheckSec } = CONFIG.timeouts;

    if (!firstMysqlNode) throw new Error('No MySQL nodes found');
    const proxySqlNode = containers.find(c => c.includes('proxysql')) || 'proxysql';
    const redisNode = containers.find(c => c.includes('redis')) || 'redis-server';

    // Fire all independent checks in parallel
    const [routerRWResult, routerROResult, routerAPIHTTPResult, routerAPIHTTPSResult, proxyBackendsResult, proxyDataResult, redisResult] = await Promise.allSettled([
        // MySQL Router R/W (port 6446)
        dockerExecEnvAsync(firstMysqlNode, [MYSQL_PWD_ENV], ['mysql', '-h', mysqlRouterNode, '-P', routerRW, MYSQL_USER_FLAG, '-N', '-s', '-e', 'SELECT @@hostname;']),
        // MySQL Router R/O (port 6447)
        dockerExecEnvAsync(firstMysqlNode, [MYSQL_PWD_ENV], ['mysql', '-h', mysqlRouterNode, '-P', routerRO, MYSQL_USER_FLAG, '-N', '-s', '-e', 'SELECT @@hostname;']),
        // Router REST API — HTTP (should fail = HTTPS enforced)
        dockerExecAsync(datadogUnifiedNode, ['curl', '-s', '-m', routerHttpCheckSec, `http://${mysqlRouterNode}:${routerAPI}${CONFIG.routerApiPath}`]),
        // Router REST API — HTTPS
        dockerExecAsync(datadogUnifiedNode, ['curl', '-sk', '-u', `${routerApi.user}:${routerApi.password}`, `https://${mysqlRouterNode}:${routerAPI}${CONFIG.routerApiPath}`]),
        // ProxySQL backend status
        dockerExecEnvAsync(proxySqlNode, [`MYSQL_PWD=${proxyAdmin.password}`], ['mysql', '-h', '127.0.0.1', '-P', proxySQLAdmin, `-u${proxyAdmin.user}`, '-N', '-s', '-e', 'SELECT hostgroup_id, hostname, status FROM runtime_mysql_servers ORDER BY hostgroup_id, hostname;']),
        // ProxySQL data port (6033)
        dockerExecEnvAsync(firstMysqlNode, [`MYSQL_PWD=${proxyData.password}`], ['mysql', '-h', 'proxysql', '-P', proxySQLData, `-u${proxyData.user}`, '-N', '-s', '-e', 'SELECT 1;']),
        // Redis PING + SET/GET cycle
        dockerExecAsync(redisNode, ['redis-cli', 'PING']),
    ]);

    // Router R/W
    const routerRW_val = settled(routerRWResult);
    if (routerRW_val && routerRW_val.trim().length > 0) {
        console.log(`✅ Router R/W (${routerRW})    : Routed to ${routerRW_val.trim()}`);
    } else {
        console.log(`❌ Router R/W (${routerRW})    : Cannot route queries`);
        allUp = false;
    }

    // Router R/O
    const routerRO_val = settled(routerROResult);
    if (routerRO_val && routerRO_val.trim().length > 0) {
        console.log(`✅ Router R/O (${routerRO})    : Routed to ${routerRO_val.trim()}`);
    } else {
        console.log(`❌ Router R/O (${routerRO})    : Cannot route queries`);
        allUp = false;
    }

    // Router REST API — verify HTTPS enforcement
    const routerAPIHTTP_val = settled(routerAPIHTTPResult);
    const routerAPIHTTPS_val = settled(routerAPIHTTPSResult);

    if (routerAPIHTTPS_val && routerAPIHTTPS_val.includes(CONFIG.routerApiResponseKey)) {
        if (routerAPIHTTP_val === null || routerAPIHTTP_val.trim() === '') {
            console.log('✅ Router REST API      : Responding securely (HTTPS enforced, HTTP rejected)');
        } else {
            console.log('⚠️ Router REST API      : Responding to HTTPS, but HTTP unexpectedly did not fail');
            allUp = false;
        }
    } else {
        console.log('❌ Router REST API      : Not responding to HTTPS');
        allUp = false;
    }

    // ProxySQL backends
    const proxyBackends_val = settled(proxyBackendsResult);
    if (proxyBackends_val) {
        const lines = splitLines(proxyBackends_val.trim()).filter(Boolean);
        const offlineBackends = lines.filter(l => !l.includes('ONLINE'));
        if (offlineBackends.length === 0 && lines.length > 0) {
            console.log(`✅ ProxySQL backends    : ${lines.length} backends, all ONLINE`);
        } else if (lines.length > 0) {
            console.log(`⚠️ ProxySQL backends    : ${offlineBackends.length}/${lines.length} backends NOT ONLINE`);
            for (const line of offlineBackends) {
                console.log(`   ${line}`);
            }
            allUp = false;
        } else {
            console.log('❌ ProxySQL backends    : No backends configured');
            allUp = false;
        }
    } else {
        console.log(`❌ ProxySQL admin       : Cannot connect to admin interface (${proxySQLAdmin})`);
        allUp = false;
    }

    // ProxySQL data port
    const proxyData_val = settled(proxyDataResult);
    if (proxyData_val && proxyData_val.trim() === '1') {
        console.log(`✅ ProxySQL data (${proxySQLData}) : Routing queries successfully`);
    } else {
        console.log(`❌ ProxySQL data (${proxySQLData}) : Cannot route queries`);
        allUp = false;
    }

    // Redis — PING first, then SET/GET cycle if needed
    const redisPing_val = settled(redisResult);
    if (redisPing_val && redisPing_val.trim() === 'PONG') {
        // Test write + read cycle (sequential since GET depends on SET)
        const redisSet = await dockerExecAsync(redisNode, ['redis-cli', 'SET', CONFIG.redis.healthKey, CONFIG.redis.healthValue, 'EX', CONFIG.redis.healthTtlSec]);
        const redisGet = await dockerExecAsync(redisNode, ['redis-cli', 'GET', CONFIG.redis.healthKey]);
        if (redisSet && redisSet.trim() === 'OK' && redisGet && redisGet.trim() === CONFIG.redis.healthValue) {
            console.log('✅ Redis                : PING + SET/GET cycle passed');
        } else {
            console.log('⚠️ Redis                : PING ok but SET/GET failed');
            allUp = false;
        }
    } else {
        console.log('❌ Redis                : Not responding to PING');
        allUp = false;
    }
});

// ============================================================
// Section 5: Observability Stack (Parallel)
// ============================================================
await runSectionAsync('Observability Stack', async () => {
    console.log('\n5. Observability Stack:');
    console.log(SEPARATOR);

    const { curlSec } = CONFIG.timeouts;

    // Fire all independent observability checks in parallel
    const [promHealthResult, grafanaHealthResult, lokiReadyResult, alloyReadyResult] = await Promise.allSettled([
        dockerExecAsync(prometheusNode, ['wget', '-qO-', 'http://localhost:9090/-/healthy']),
        dockerExecAsync(datadogUnifiedNode, ['curl', '-s', '--connect-timeout', curlSec, `http://grafana:${CONFIG.ports.grafana}/api/health`]),
        dockerExecAsync(datadogUnifiedNode, ['curl', '-s', '--connect-timeout', curlSec, `http://loki:${CONFIG.ports.loki}/ready`]),
        dockerExecAsync(datadogUnifiedNode, ['curl', '-s', '--connect-timeout', curlSec, `http://alloy:${CONFIG.ports.alloy}/-/ready`]),
    ]);

    // Prometheus health
    const promHealth = settled(promHealthResult);
    if (promHealth && promHealth.includes('Healthy')) {
        // Scrape targets check (sequential since it depends on health)
        const promTargets = await dockerExecAsync(prometheusNode, ['wget', '-qO-', `http://localhost:${CONFIG.ports.prometheus}/api/v1/targets?state=active`]);
        if (promTargets) {
            const parsed = safeParse(promTargets);
            if (parsed.ok) {
                const activeTargets = parsed.data?.data?.activeTargets || [];
                const downTargets = activeTargets.filter(t => t.health !== 'up');
                if (downTargets.length === 0 && activeTargets.length > 0) {
                    console.log(`✅ Prometheus           : Healthy, ${activeTargets.length} target(s) all UP`);
                } else if (activeTargets.length === 0) {
                    console.log('⚠️ Prometheus           : Healthy but no active scrape targets');
                    allUp = false;
                } else {
                    console.log(`⚠️ Prometheus           : ${downTargets.length}/${activeTargets.length} target(s) DOWN`);
                    for (const t of downTargets) {
                        console.log(`   ❌ ${t.labels?.job || 'unknown'}/${t.labels?.instance || 'unknown'}: ${t.lastError || 'unknown error'}`);
                    }
                    allUp = false;
                }
            } else {
                console.log('✅ Prometheus           : Healthy (targets API parse failed, non-critical)');
            }
        } else {
            console.log('✅ Prometheus           : Healthy (targets check skipped)');
        }
    } else {
        console.log('❌ Prometheus           : Not healthy');
        allUp = false;
    }

    // Grafana health
    const grafanaHealth = settled(grafanaHealthResult);
    if (grafanaHealth) {
        const parsed = safeParse(grafanaHealth);
        if (parsed.ok && parsed.data) {
            if (parsed.data.database === 'ok') {
                console.log('✅ Grafana              : Healthy (database: ok)');
            } else {
                console.log(`⚠️ Grafana              : Responding but database: ${parsed.data.database || 'unknown'}`);
                allUp = false;
            }
        } else {
            console.log('✅ Grafana              : Responding');
        }
    } else {
        console.log('❌ Grafana              : Not responding');
        allUp = false;
    }

    // Loki ready — also query labels API to confirm Alloy→Loki pipeline is shipping data
    const lokiReady = settled(lokiReadyResult);
    if (lokiReady && lokiReady.toLowerCase().includes('ready')) {
        const lokiLabels = await dockerExecAsync(datadogUnifiedNode, ['curl', '-s', '--connect-timeout', curlSec, `http://loki:${CONFIG.ports.loki}/loki/api/v1/labels`]);
        let labelCount = 0;
        if (lokiLabels) {
            const parsed = safeParse(lokiLabels);
            if (parsed.ok) { labelCount = parsed.data?.data?.length || 0; }
        }
        if (labelCount > 0) {
            console.log(`✅ Loki                 : Ready (${labelCount} label(s) indexed — Alloy pipeline active)`);
        } else {
            console.log('✅ Loki                 : Ready (no labels yet — normal on fresh start)');
        }
    } else {
        console.log('❌ Loki                 : Not ready');
        allUp = false;
    }

    // Alloy ready
    const alloyReady = settled(alloyReadyResult);
    if (alloyReady && alloyReady.toLowerCase().includes('ready')) {
        console.log('✅ Alloy                : Ready');
    } else {
        console.log('❌ Alloy                : Not ready');
        allUp = false;
    }
});

// ============================================================
// Section 6: Datadog Integration Status
// ============================================================
runSection('Datadog Integration Status', () => {
    console.log('\n6. Datadog Integration Status:');
    console.log(SEPARATOR);

    // Primary indicator: Docker-level health (already collected in Section 1 — immune to transient agent health exec failures)
    const ddDockerStatus = runningContainers[datadogUnifiedNode]?.status ?? '';
    const ddContainerHealthy = ddDockerStatus.includes('healthy') && !ddDockerStatus.includes('unhealthy');

    if (ddContainerHealthy) {
        // Get full status to parse per-integration check results
        const ddStatus = dockerExec(datadogUnifiedNode, ['agent', 'status'], true);
        if (ddStatus) {
            // Single-pass categorization — avoids 4 intermediate array allocations
            const { errorInstances, warningInstances, okInstances } = splitLines(ddStatus).reduce(
                (acc, l) => {
                    if (!l.includes('Instance ID:')) return acc;
                    if (l.includes('[ERROR]'))        acc.errorInstances.push(l);
                    else if (l.includes('[WARNING]')) acc.warningInstances.push(l);
                    else if (l.includes('[OK]'))      acc.okInstances.push(l);
                    return acc;
                },
                { errorInstances: [], warningInstances: [], okInstances: [] }
            );

            if (errorInstances.length === 0 && warningInstances.length === 0 && okInstances.length > 0) {
                console.log(`✅ Datadog Agent        : Healthy, ${okInstances.length} integration checks all OK`);
            } else if (okInstances.length === 0 && errorInstances.length === 0) {
                console.log(`✅ Datadog Agent        : Healthy (integration checks still initializing)`);
            } else {
                if (errorInstances.length > 0) {
                    console.log(`❌ Datadog Agent        : ${errorInstances.length} integration ERROR(s)`);
                    for (const line of errorInstances) {
                        const match = line.match(/Instance ID:\s*(.+?)\s*\[ERROR\]/);
                        console.log(`   ❌ ${match ? match[1].trim() : line.trim()}`);
                    }
                    allUp = false;
                }
                if (warningInstances.length > 0) {
                    console.log(`⚠️  Datadog Agent        : ${warningInstances.length} integration WARNING(s)`);
                    for (const line of warningInstances) {
                        const match = line.match(/Instance ID:\s*(.+?)\s*\[WARNING\]/);
                        console.log(`   ⚠️  ${match ? match[1].trim() : line.trim()}`);
                    }
                }
                if (okInstances.length > 0) {
                    console.log(`   ✅ ${okInstances.length} other checks OK`);
                }
            }
        } else {
            // agent status exec failed but Docker health is green — non-critical
            console.log(`✅ Datadog Agent        : Docker-healthy (integration status temporarily unavailable)`);
        }
    } else {
        console.log('❌ Datadog Agent        : Not healthy');
        allUp = false;
    }
});

// ============================================================
// Section 7: MCP Server Metrics
// ============================================================
runSection('MCP Server Metrics', () => {
    console.log('\n7. MCP Server Metrics:');
    console.log(SEPARATOR);

    const mcpMetrics = dockerExec(datadogUnifiedNode, ['curl', '-s', '--connect-timeout', CONFIG.timeouts.curlSec, `http://mysql-mcp-exporter:${CONFIG.ports.mcpExporter}/metrics`], true);
    if (mcpMetrics && mcpMetrics.includes(CONFIG.metricsPrefix)) {
        // Count unique metric families via regex (avoids full array allocation)
        const seen = new Set();
        const helpRegex = /^# HELP (\S+)/gm;
        let match;
        while ((match = helpRegex.exec(mcpMetrics)) !== null) {
            seen.add(match[1]);
        }
        console.log(`✅ MCP Server (port ${CONFIG.ports.mcpExporter}): Exporting ${seen.size} metric families`);
    } else if (mcpMetrics !== null) {
        console.log(`❌ MCP Server (port ${CONFIG.ports.mcpExporter}): Responding but no ${CONFIG.metricsPrefix} metrics found`);
        allUp = false;
    } else {
        console.log(`❌ MCP Server (port ${CONFIG.ports.mcpExporter}): Not running`);
        allUp = false;
    }
});

// ============================================================
// Section 8: Test Database Integrity (N+1 fix — single SQL query)
// ============================================================
runSection('Test Database Integrity', () => {
    console.log('\n8. Test Database Integrity:');
    console.log(SEPARATOR);

    const tableNames = Object.keys(CONFIG.expectedTables);

    // Single UNION ALL query replaces 12 individual docker exec calls
    const unionParts = tableNames.map(t => `SELECT '${t}' AS t, COUNT(*) AS c FROM ${CONFIG.database}.${t}`);
    const batchQuery = unionParts.join(' UNION ALL ');
    if (!firstMysqlNode) throw new Error('No MySQL nodes found');

    const batchOut = dockerExecEnv(firstMysqlNode, [MYSQL_PWD_ENV],
        ['mysql', '-h', mysqlRouterNode, '-P', CONFIG.ports.routerRW, MYSQL_USER_FLAG, CONFIG.database, '-N', '-s', '-e', `${batchQuery};`], true);

    let dbIntegrityOk = true;
    const tableFailures = [];

    if (!batchOut) {
        // Batch query failed — likely all tables missing or connection issue
        for (const table of tableNames) {
            tableFailures.push(`${table}: missing or inaccessible`);
        }
        dbIntegrityOk = false;
    } else {
        // Parse tab-separated results: "table_name\tcount" per line
        const foundTables = new Map();
        for (const line of splitLines(batchOut.trim()).filter(Boolean)) {
            const parts = line.split('\t');
            const rowCount = parseInt(parts[1], 10);
            if (parts.length >= 2 && !isNaN(rowCount)) {
                foundTables.set(parts[0], rowCount);
            }
        }

        for (const [table, minRows] of Object.entries(CONFIG.expectedTables)) {
            if (!foundTables.has(table)) {
                tableFailures.push(`${table}: missing or inaccessible`);
                dbIntegrityOk = false;
            } else {
                const count = foundTables.get(table);
                if (count < minRows) {
                    tableFailures.push(`${table}: ${count} rows (expected ${minRows}+)`);
                    dbIntegrityOk = false;
                }
            }
        }
    }

    if (dbIntegrityOk) {
        console.log(`✅ ${CONFIG.database}               : All ${tableNames.length} tables present with expected row counts`);
    } else {
        console.log(`❌ ${CONFIG.database}               : ${tableFailures.length} table(s) have issues:`);
        for (const f of tableFailures) console.log(`   ❌ ${f}`);
        console.log(`   Run 'node scripts/reset-database.mjs' to reseed.`);
        allUp = false;
    }
});



// ============================================================
// Section 9: Filesystem Boundaries
// ============================================================
await runSectionAsync('Filesystem Boundaries', async () => {
    console.log('\n9. Filesystem Boundaries:');
    console.log(SEPARATOR);
    
    // Check if the volumes are mounted correctly in mysql-node1 (only check if node1 is up)
    if (runningContainers[firstMysqlNode] && runningContainers[firstMysqlNode].state === 'running') {
        // Two independent ls calls — fire in parallel
        const [workspaceResult, scratchResult] = await Promise.all([
            dockerExecAsync(firstMysqlNode, ['ls', CONFIG.workspace.mcpPackageJson]),
            dockerExecAsync(firstMysqlNode, ['ls', '-d', CONFIG.workspace.scratchDir]),
        ]);
        const workspaceCheck = workspaceResult;
        const scratchCheck = scratchResult;

        let fsOk = true;
        if (workspaceCheck && !workspaceCheck.includes('No such file')) {
            console.log('✅ /workspace/mysql-mcp : Mounted successfully');
        } else {
            console.log('❌ /workspace/mysql-mcp : Missing or unreadable');
            fsOk = false;
        }

        if (scratchCheck && !scratchCheck.includes('No such file')) {
            console.log('✅ /workspace/scratch   : Mounted successfully');
        } else {
            console.log('❌ /workspace/scratch   : Missing or unreadable');
            fsOk = false;
        }

        if (!fsOk) allUp = false;
    } else {
        console.log('⚠️ Filesystem Boundaries: Skipped (mysql-node1 is not running)');
    }
});



// ============================================================
// Final Summary
// ============================================================
console.log('\n========================================');
if (allUp) {
    console.log('🎉 Ecosystem is fully healthy and ready for testing!');
} else {
    console.log('⚠️ Ecosystem has issues. Please resolve them before testing.');
    process.exit(1);
}

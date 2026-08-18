import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { detectDocker } from './utils.mjs';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
    ECOSYSTEM_ROOT,
    CONFIG,
    MYSQL_PWD_ENV,
    MYSQL_USER_FLAG,
    splitLines,
    safeParse,
    stripMysqlWarning,
    settled,
    EXEC_ENV
} from './core-config.mjs';
import {
    runRoutingValidationSection,
    runObservabilityStackSection,
    runDatadogIntegrationSection,
    runMcpMetricsSection,
    runDatabaseIntegritySection,
    runFilesystemBoundariesSection
} from './check-status-sections.mjs';

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
// Populated by Section 6, consumed by Section 7
let ddStatus = null;

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
    const up = await runRoutingValidationSection({
        firstMysqlNode, containers, mysqlRouterNode, dockerExecEnvAsync, dockerExecAsync, settled
    });
    if (!up) allUp = false;
});

// ============================================================
// Section 5: Observability Stack (Parallel)
// ============================================================
await runSectionAsync('Observability Stack', async () => {
    const up = await runObservabilityStackSection({
        datadogUnifiedNode, prometheusNode, dockerExecAsync, settled, safeParse
    });
    if (!up) allUp = false;
});

// ============================================================
// Section 6: Datadog Integration Status
// ============================================================
runSection('Datadog Integration Status', () => {
    const result = runDatadogIntegrationSection({
        runningContainers, datadogUnifiedNode, dockerExec
    });
    if (!result.up) allUp = false;
    ddStatus = result.ddStatusOut;
});

// ============================================================
// Section 7: MCP Server Metrics
// ============================================================
runSection('MCP Server Metrics', () => {
    const up = runMcpMetricsSection({
        dockerExec, datadogUnifiedNode, execCommand, dockerCmd, statSync: fs.statSync, ddStatus
    });
    if (!up) allUp = false;
});

// ============================================================
// Section 8: Test Database Integrity (N+1 fix — single SQL query)
// ============================================================
runSection('Test Database Integrity', () => {
    const up = runDatabaseIntegritySection({
        dockerExecEnv, firstMysqlNode, mysqlRouterNode
    });
    if (!up) allUp = false;
});

// ============================================================
// Section 9: Filesystem Boundaries
// ============================================================
await runSectionAsync('Filesystem Boundaries', async () => {
    const up = await runFilesystemBoundariesSection({
        runningContainers, firstMysqlNode, dockerExecAsync
    });
    if (!up) allUp = false;
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

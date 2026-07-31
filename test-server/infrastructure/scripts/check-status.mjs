import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const execCommand = (cmd, args, ignoreError = false) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe', cwd: REPO_ROOT });
  } catch (e) {
    if (!ignoreError) {
      console.error(`Error: ${e.message}`);
    }
    return null;
  }
};


// Dynamically discover expected containers from docker-compose.yml
const isWindows = process.platform === 'win32';
const dockerCmd = isWindows ? 'wsl' : 'docker';
const dockerArgs = isWindows ? ['docker', 'compose'] : ['compose'];

let servicesRaw = execCommand(dockerCmd, [...dockerArgs, 'config', '--services'], true);
if (!servicesRaw) {
    servicesRaw = execCommand('docker-compose', ['config', '--services'], true);
}

let containers = [];
if (servicesRaw) {
    containers = servicesRaw.trim().split('\n').filter(Boolean).sort();
} else {
    // Ultimate fallback: manually parse docker-compose.yml
    try {
        let yamlContent = fs.readFileSync(path.join(REPO_ROOT, 'docker-compose.yml'), 'utf-8');
        let lines = yamlContent.split('\n');
        let inServices = false;
        for (let line of lines) {
            if (line.startsWith('services:')) {
                inServices = true;
                continue;
            }
            if (inServices) {
                if (line.match(/^[a-zA-Z]/)) break; // Next top-level block
                let match = line.match(/^  ([a-zA-Z0-9_-]+):/);
                if (match) {
                    containers.push(match[1]);
                }
            }
        }
        containers.sort();
    } catch (e) {
        console.error('Failed to read docker-compose.yml services. Are you in the infrastructure directory?');
        process.exit(1);
    }
    
    if (containers.length === 0) {
        console.error('Failed to parse any services from docker-compose.yml. Are you in the infrastructure directory?');
        process.exit(1);
    }
}

// Helper: run a command inside a Docker container
const dockerExec = (container, cmdArgs, ignoreError = true) => {
    const args = isWindows
        ? ['docker', 'exec', container, ...cmdArgs]
        : ['exec', container, ...cmdArgs];
    return execCommand(dockerCmd, args, ignoreError);
};

// Helper: run a command inside a Docker container with env vars
const dockerExecEnv = (container, envPairs, cmdArgs, ignoreError = true) => {
    const envArgs = envPairs.flatMap(pair => ['-e', pair]);
    const args = isWindows
        ? ['docker', 'exec', ...envArgs, container, ...cmdArgs]
        : ['exec', ...envArgs, container, ...cmdArgs];
    return execCommand(dockerCmd, args, ignoreError);
};

console.log('=== Ecosystem Status Check ===\n');

let allUp = true;

// ============================================================
// Section 1: Container Status (existing)
// ============================================================
console.log(`1. Container Status (${containers.length} services):`);
console.log('----------------------------------------');

const psOutput = execCommand(dockerCmd, isWindows ? ['docker', 'ps', '-a', '--format', '{{.Names}},{{.State}},{{.Status}}'] : ['ps', '-a', '--format', '{{.Names}},{{.State}},{{.Status}}'], false);
if (!psOutput) {
    console.error(`Error: Failed to execute docker ps. Docker daemon might not be running.`);
    process.exit(1);
}

const runningContainers = psOutput.trim().split('\n').reduce((acc, line) => {
    const [name, state, status] = line.split(',');
    if (name) {
        acc[name] = { state, status };
    }
    return acc;
}, {});

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

// ============================================================
// Section 2: InnoDB Cluster Status (existing)
// ============================================================
console.log('\n2. InnoDB Cluster Status:');
console.log('----------------------------------------');

const mysqlNodes = containers.filter(c => c.startsWith('mysql-node'));
let clusterOut = null;
let primaryOut = null;

for (const node of mysqlNodes) {
    clusterOut = dockerExecEnv(node, ['MYSQL_PWD=root'], ['mysql', '-uroot', '-e', 'SELECT member_state FROM performance_schema.replication_group_members;'], true);
    if (clusterOut !== null) {
        primaryOut = dockerExecEnv(node, ['MYSQL_PWD=root'], ['mysql', '-uroot', '-N', '-s', '-e', "SELECT member_host FROM performance_schema.replication_group_members WHERE member_role='PRIMARY';"], true);
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
            const readOnlyCheck = dockerExecEnv(primaryHostName, ['MYSQL_PWD=root'], ['mysql', '-uroot', '-N', '-s', '-e', 'SELECT @@super_read_only;'], true);
            let readOnlyVal = readOnlyCheck ? readOnlyCheck.trim() : null;
            if (readOnlyVal && readOnlyVal.includes('mysql: [Warning]')) {
                readOnlyVal = readOnlyVal.split('\n').pop().trim();
            }
            if (readOnlyVal === '1') {
                console.log(`   ❌ PRIMARY IS STUCK IN READ-ONLY MODE (super_read_only=1)`);
                console.log(`      Run 'node scripts/toggle-super-read.mjs OFF' to fix this cluster state.`);
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

// ============================================================
// Section 3: MySQL Shell Metadata Verification (existing)
// ============================================================
console.log('\n3. MySQL Shell Metadata Verification:');
console.log('----------------------------------------');
let shellOut = null;
if (mysqlNodes.length > 0) {
    const node = mysqlNodes[0];
    const jsPayload = "try { var c = dba.getCluster('mcpCluster'); print('OK'); } catch(e) { print('ERROR: ' + e.message); process.exit(1); }";
    shellOut = dockerExec(node, ['mysqlsh', '--user=root', '--password=root', '--host=127.0.0.1', '--port=3306', '--js', '-e', jsPayload], true);
    
    if (shellOut && shellOut.includes('OK')) {
        console.log(`✅ mysqlsh successfully read InnoDB Cluster metadata ('mcpCluster')`);
    } else {
        console.log(`❌ mysqlsh could not verify cluster metadata`);
        if (shellOut) {
            const errLine = shellOut.split('\n').find(l => l.includes('ERROR') || l.includes('Exception'));
            console.log(`   ${errLine || shellOut.trim().split('\n').pop()}`);
        }
        allUp = false;
    }
} else {
    console.log(`❌ No mysql nodes found to execute mysqlsh`);
    allUp = false;
}

// ============================================================
// Section 4: Routing & Proxy Data-Plane Validation
// ============================================================
console.log('\n4. Routing & Proxy Validation:');
console.log('----------------------------------------');

// MySQL Router R/W (port 6446) — execute from mysql-node1 which is on the same Docker network
const routerRW = dockerExecEnv('mysql-node1', ['MYSQL_PWD=root'], ['mysql', '-h', 'mysql-router', '-P', '6446', '-uroot', '-N', '-s', '-e', 'SELECT @@hostname;'], true);
if (routerRW && routerRW.trim().length > 0) {
    console.log(`✅ Router R/W (6446)    : Routed to ${routerRW.trim()}`);
} else {
    console.log('❌ Router R/W (6446)    : Cannot route queries');
    allUp = false;
}

// MySQL Router R/O (port 6447)
const routerRO = dockerExecEnv('mysql-node1', ['MYSQL_PWD=root'], ['mysql', '-h', 'mysql-router', '-P', '6447', '-uroot', '-N', '-s', '-e', 'SELECT @@hostname;'], true);
if (routerRO && routerRO.trim().length > 0) {
    console.log(`✅ Router R/O (6447)    : Routed to ${routerRO.trim()}`);
} else {
    console.log('❌ Router R/O (6447)    : Cannot route queries');
    allUp = false;
}

// MySQL Router REST API — verify HTTPS enforcement
const routerAPIHTTP = dockerExec('datadog-unified', ['curl', '-s', '-m', '2', 'http://mysql-router:8443/api/20190715/router/status'], true);
const routerAPIHTTPS = dockerExec('datadog-unified', ['curl', '-sk', '-u', 'rest_api:router_api', 'https://mysql-router:8443/api/20190715/router/status'], true);

if (routerAPIHTTPS && routerAPIHTTPS.includes('processId')) {
    if (routerAPIHTTP === null || routerAPIHTTP.trim() === '') {
        console.log('✅ Router REST API      : Responding securely (HTTPS enforced, HTTP rejected)');
    } else {
        console.log('⚠️ Router REST API      : Responding to HTTPS, but HTTP unexpectedly did not fail');
        allUp = false;
    }
} else {
    console.log('❌ Router REST API      : Not responding to HTTPS');
    allUp = false;
}

// ProxySQL backend status
const proxyBackends = dockerExec('proxysql', ['mysql', '-h', '127.0.0.1', '-P', '6032', '-uradmin', '-pradmin', '-N', '-s', '-e', 'SELECT hostgroup_id, hostname, status FROM runtime_mysql_servers ORDER BY hostgroup_id, hostname;'], true);
if (proxyBackends) {
    const lines = proxyBackends.trim().split('\n').filter(Boolean);
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
    console.log('❌ ProxySQL admin       : Cannot connect to admin interface (6032)');
    allUp = false;
}

// ProxySQL data port (6033) — execute from mysql-node1
const proxyData = dockerExecEnv('mysql-node1', ['MYSQL_PWD=cluster_admin'], ['mysql', '-h', 'proxysql', '-P', '6033', '-ucluster_admin', '-N', '-s', '-e', 'SELECT 1;'], true);
if (proxyData && proxyData.trim() === '1') {
    console.log('✅ ProxySQL data (6033) : Routing queries successfully');
} else {
    console.log('❌ ProxySQL data (6033) : Cannot route queries');
    allUp = false;
}

// Redis
const redisPing = dockerExec('redis-server', ['redis-cli', 'PING'], true);
if (redisPing && redisPing.trim() === 'PONG') {
    // Test write + read cycle
    const redisSet = dockerExec('redis-server', ['redis-cli', 'SET', 'healthcheck:test', 'ok', 'EX', '10'], true);
    const redisGet = dockerExec('redis-server', ['redis-cli', 'GET', 'healthcheck:test'], true);
    if (redisSet && redisSet.trim() === 'OK' && redisGet && redisGet.trim() === 'ok') {
        console.log('✅ Redis                : PING + SET/GET cycle passed');
    } else {
        console.log('⚠️ Redis                : PING ok but SET/GET failed');
        allUp = false;
    }
} else {
    console.log('❌ Redis                : Not responding to PING');
    allUp = false;
}

// ============================================================
// Section 5: Observability Stack
// ============================================================
console.log('\n5. Observability Stack:');
console.log('----------------------------------------');

// Prometheus health
const promHealth = dockerExec('prometheus', ['wget', '-qO-', 'http://localhost:9090/-/healthy'], true);
if (promHealth && promHealth.includes('Healthy')) {
    // Check scrape targets
    const promTargets = dockerExec('prometheus', ['wget', '-qO-', 'http://localhost:9090/api/v1/targets?state=active'], true);
    if (promTargets) {
        try {
            const targetsData = JSON.parse(promTargets);
            const activeTargets = targetsData?.data?.activeTargets || [];
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
        } catch {
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
const grafanaHealth = dockerExec('datadog-unified', ['curl', '-s', '--connect-timeout', '5', 'http://grafana:3000/api/health'], true);
if (grafanaHealth) {
    try {
        const gData = JSON.parse(grafanaHealth);
        if (gData.database === 'ok') {
            console.log('✅ Grafana              : Healthy (database: ok)');
        } else {
            console.log(`⚠️ Grafana              : Responding but database: ${gData.database || 'unknown'}`);
            allUp = false;
        }
    } catch {
        console.log('✅ Grafana              : Responding');
    }
} else {
    console.log('❌ Grafana              : Not responding');
    allUp = false;
}

// Loki ready — also query labels API to confirm Alloy→Loki pipeline is shipping data
const lokiReady = dockerExec('datadog-unified', ['curl', '-s', '--connect-timeout', '5', 'http://loki:3100/ready'], true);
if (lokiReady && lokiReady.toLowerCase().includes('ready')) {
    const lokiLabels = dockerExec('datadog-unified', ['curl', '-s', '--connect-timeout', '5', 'http://loki:3100/loki/api/v1/labels'], true);
    let labelCount = 0;
    try { labelCount = JSON.parse(lokiLabels)?.data?.length || 0; } catch { /* non-fatal */ }
    if (labelCount > 0) {
        console.log(`✅ Loki                 : Ready (${labelCount} label(s) indexed — Alloy pipeline active)`);
    } else {
        console.log('✅ Loki                 : Ready (no labels yet — normal on fresh start)');
    }
} else {
    console.log('❌ Loki                 : Not ready');
    allUp = false;
}

// Alloy ready — bound on 0.0.0.0:12345 so reachable from datadog-unified
const alloyReady = dockerExec('datadog-unified', ['curl', '-s', '--connect-timeout', '5', 'http://alloy:12345/-/ready'], true);
if (alloyReady && alloyReady.toLowerCase().includes('ready')) {
    console.log('✅ Alloy                : Ready');
} else {
    console.log('❌ Alloy                : Not ready');
    allUp = false;
}

// ============================================================
// Section 6: Datadog Integration Status
// ============================================================
console.log('\n6. Datadog Integration Status:');
console.log('----------------------------------------');

// Primary indicator: Docker-level health (already collected in Section 1 — immune to transient agent health exec failures)
const ddDockerStatus = runningContainers['datadog-unified']?.status ?? '';
const ddContainerHealthy = ddDockerStatus.includes('healthy') && !ddDockerStatus.includes('unhealthy');

if (ddContainerHealthy) {
    // Get full status to parse per-integration check results
    const ddStatus = dockerExec('datadog-unified', ['agent', 'status'], true);
    if (ddStatus) {
        // Extract Instance ID lines with their status
        const instanceLines = ddStatus.split('\n').filter(l => l.includes('Instance ID:'));
        const errorInstances = instanceLines.filter(l => l.includes('[ERROR]'));
        const warningInstances = instanceLines.filter(l => l.includes('[WARNING]'));
        const okInstances = instanceLines.filter(l => l.includes('[OK]'));

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

// ============================================================
// Section 7: MCP Server Metrics
// ============================================================
console.log('\n7. MCP Server Metrics:');
console.log('----------------------------------------');

const mcpMetrics = dockerExec('datadog-unified', ['curl', '-s', '--connect-timeout', '5', 'http://mysql-mcp-exporter:3000/metrics'], true);
if (mcpMetrics && mcpMetrics.includes('mysql_mcp_')) {
    // Count unique metric families
    const metricFamilies = new Set(
        mcpMetrics.split('\n')
            .filter(l => l.startsWith('# HELP'))
            .map(l => l.split(' ')[2])
    );
    console.log(`✅ MCP Server (port 3000): Exporting ${metricFamilies.size} metric families`);
} else if (mcpMetrics !== null) {
    console.log('❌ MCP Server (port 3000): Responding but no mysql_mcp_ metrics found');
    allUp = false;
} else {
    console.log('❌ MCP Server (port 3000): Not running');
    allUp = false;
}

// ============================================================
// Section 8: Test Database Integrity
// ============================================================
console.log('\n8. Test Database Integrity:');
console.log('----------------------------------------');

const expectedTables = {
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
};

let dbIntegrityOk = true;
const tableFailures = [];

for (const [table, minRows] of Object.entries(expectedTables)) {
    const countOut = dockerExecEnv('mysql-node1', ['MYSQL_PWD=root'],
        ['mysql', '-h', 'mysql-router', '-P', '6446', '-uroot', 'testdb', '-N', '-s', '-e', `SELECT COUNT(*) FROM ${table};`], true);
    if (!countOut) {
        tableFailures.push(`${table}: missing or inaccessible`);
        dbIntegrityOk = false;
    } else {
        const count = parseInt((countOut.trim().match(/\d+/) || ['0'])[0], 10);
        if (count < minRows) {
            tableFailures.push(`${table}: ${count} rows (expected ${minRows}+)`);
            dbIntegrityOk = false;
        }
    }
}

if (dbIntegrityOk) {
    console.log(`✅ testdb               : All ${Object.keys(expectedTables).length} tables present with expected row counts`);
} else {
    console.log(`❌ testdb               : ${tableFailures.length} table(s) have issues:`);
    for (const f of tableFailures) console.log(`   ❌ ${f}`);
    console.log(`   Run 'node scripts/reset-database.mjs' to reseed.`);
    allUp = false;
}

// ============================================================
// Section 9: Host System Dependencies
// ============================================================
console.log('\n9. Host System Dependencies:');
console.log('----------------------------------------');

const hostShellOut = execCommand('mysqlsh', ['--version'], true);
if (hostShellOut && hostShellOut.toLowerCase().includes('mysqlsh')) {
    const versionMatch = hostShellOut.match(/Ver\s+([^\s]+)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';
    console.log(`✅ MySQL Shell (Host)   : Found natively in PATH (Version ${version})`);
} else {
    console.log(`⚠️ MySQL Shell (Host)   : Not found natively in PATH!`);
    console.log(`   (The mysql-ecosystem MCP server requires mysqlsh installed on the host machine to execute tools)`);
    allUp = false;
}

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

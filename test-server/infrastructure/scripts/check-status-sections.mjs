import fs from 'fs';
import { CONFIG, splitLines, MYSQL_PWD_ENV, MYSQL_USER_FLAG } from './core-config.mjs';

export function runMcpMetricsSection(ctx) {
    const { dockerExec, datadogUnifiedNode, execCommand, dockerCmd, statSync } = ctx;
    let up = true;
    
    console.log('\n7. MCP Server Metrics:');
    console.log('----------------------------------------');

    const mcpMetrics = dockerExec(datadogUnifiedNode, ['curl', '-s', '--connect-timeout', CONFIG.timeouts.curlSec, `http://mysql-mcp-exporter:${CONFIG.ports.mcpExporter}/metrics`], true);
    
    if (mcpMetrics && mcpMetrics.includes(CONFIG.metricsPrefix)) {
        const seen = new Set();
        const helpRegex = /^# HELP (\S+)/gm;
        let match;
        while ((match = helpRegex.exec(mcpMetrics)) !== null) seen.add(match[1]);
        console.log(`✅ MCP Exporter         : Responding, exporting ${seen.size} metric families`);

        const uptimeLine = mcpMetrics.match(/^mysql_mcp_server_uptime_seconds\s+([0-9.]+)/m);
        const uptime = uptimeLine ? parseFloat(uptimeLine[1]) : 0;
        const toolLines = mcpMetrics.match(/^mysql_mcp_tool_calls_total\{.+\}\s+\d+/gm) || [];
        const nonZeroTools = toolLines.filter(l => !l.endsWith(' 0'));
        if (uptime > CONFIG.metrics.gracePeriodSec && nonZeroTools.length === 0 && toolLines.length > 0) {
            console.log(`⚠️  MCP Exporter         : All ${toolLines.length} tool counters are zero (uptime: ${Math.round(uptime)}s). JSONL sync might be failing.`);
            up = false;
        } else if (toolLines.length > 0) {
            console.log(`✅ MCP Exporter         : Historical sync active (${nonZeroTools.length}/${toolLines.length} tools have non-zero calls)`);
        } else {
            console.log(`⚠️  MCP Exporter         : No tool counters found`);
        }

        let missingFamilies = CONFIG.metrics.requiredFamilies.filter(fam => !mcpMetrics.includes(fam));
        if (missingFamilies.length === 0) {
            console.log(`✅ MCP Exporter         : Found required AI token metric families`);
        } else {
            console.log(`❌ MCP Exporter         : Missing required metrics: ${missingFamilies.join(', ')}`);
            up = false;
        }
    } else if (mcpMetrics !== null) {
        console.log(`❌ MCP Exporter         : Responding but no ${CONFIG.metricsPrefix} metrics found`);
        up = false;
    } else {
        console.log(`❌ MCP Exporter         : Not running or reachable`);
        up = false;
    }

    if (ctx.ddStatus) {
        const openmetricsMatch = ctx.ddStatus.match(/Instance ID: openmetrics:mysql_mcp.*?\n[\s\S]*?Metric Samples: Last Run: ([\d,]+)/);
        const hasOpenmetricsCheck = ctx.ddStatus.includes('Instance ID: openmetrics:mysql_mcp');
        
        if (openmetricsMatch) {
            const metricsCount = parseInt(openmetricsMatch[1].replace(/,/g, ''), 10);
            if (metricsCount > 0) {
                console.log(`✅ Datadog openmetrics  : Ingesting ${metricsCount} metrics from exporter`);
            } else {
                console.log(`⚠️  Datadog openmetrics  : Check is OK but ingesting 0 metrics`);
                up = false;
            }
        } else if (hasOpenmetricsCheck) {
            console.log(`⚠️  Datadog openmetrics  : Check exists but couldn't parse metric counts. Check 'agent status'.`);
        } else {
            console.log(`❌ Datadog openmetrics  : Not configured to scrape mysql-mcp-exporter`);
            up = false;
        }
    } else {
        console.log(`⚠️  Datadog openmetrics  : Skipped (Datadog agent is down)`);
    }

    const containerCreatedStr = execCommand(dockerCmd, dockerCmd === 'wsl' ? ['docker', 'inspect', '--format', '{{.Created}}', 'mysql-mcp-exporter'] : ['inspect', '--format', '{{.Created}}', 'mysql-mcp-exporter'], true);
    if (containerCreatedStr && !containerCreatedStr.includes('No such object')) {
        const containerTime = Date.parse(containerCreatedStr.trim());
        try {
            const buildTime = statSync(CONFIG.workspace.mysqlMcpDist).mtimeMs;
            const hoursDiff = (buildTime - containerTime) / (1000 * 60 * 60);
            if (hoursDiff > CONFIG.metrics.imageFreshnessHours) {
                console.log(`⚠️  MCP Exporter Image   : Container is ${Math.round(hoursDiff)} hours OLDER than dist/ build artifacts. Stale image? Rebuild requested.`);
            } else {
                console.log(`✅ MCP Exporter Image   : Fresh (built within ${CONFIG.metrics.imageFreshnessHours}h of latest changes)`);
            }
        } catch (e) {
            console.log(`⚠️  MCP Exporter Image   : Could not read dist/ directory to verify freshness: ${e.message}`);
        }
    }
    return up;
}

export function runDatabaseIntegritySection(ctx) {
    const { dockerExecEnv, firstMysqlNode, mysqlRouterNode } = ctx;
    let up = true;
    
    console.log('\n8. Test Database Integrity:');
    console.log('----------------------------------------');

    const tableNames = Object.keys(CONFIG.expectedTables);
    const batchQuery = tableNames.map(t => `SELECT '${t}' AS t, COUNT(*) AS c FROM ${CONFIG.database}.${t}`).join(' UNION ALL ');
    if (!firstMysqlNode) throw new Error('No MySQL nodes found');

    const batchOut = dockerExecEnv(firstMysqlNode, [MYSQL_PWD_ENV],
        ['mysql', '-h', mysqlRouterNode, '-P', CONFIG.ports.routerRW, MYSQL_USER_FLAG, CONFIG.database, '-N', '-s', '-e', `${batchQuery};`], true);

    const tableFailures = [];
    if (!batchOut) {
        tableNames.forEach(table => tableFailures.push(`${table}: missing or inaccessible`));
        up = false;
    } else {
        const foundTables = new Map();
        for (const line of splitLines(batchOut.trim()).filter(Boolean)) {
            const parts = line.split('\t');
            const rowCount = parseInt(parts[1], 10);
            if (parts.length >= 2 && !isNaN(rowCount)) foundTables.set(parts[0], rowCount);
        }

        for (const [table, minRows] of Object.entries(CONFIG.expectedTables)) {
            if (!foundTables.has(table)) {
                tableFailures.push(`${table}: missing or inaccessible`);
                up = false;
            } else {
                const count = foundTables.get(table);
                if (count < minRows) {
                    tableFailures.push(`${table}: ${count} rows (expected ${minRows}+)`);
                    up = false;
                }
            }
        }
    }

    if (up) {
        console.log(`✅ ${CONFIG.database}               : All ${tableNames.length} tables present with expected row counts`);
    } else {
        console.log(`❌ ${CONFIG.database}               : ${tableFailures.length} table(s) have issues:`);
        tableFailures.forEach(f => console.log(`   ❌ ${f}`));
        console.log(`   Run 'node scripts/reset-database.mjs' to reseed.`);
    }
    return up;
}

export async function runFilesystemBoundariesSection(ctx) {
    const { runningContainers, firstMysqlNode, dockerExecAsync } = ctx;
    let up = true;

    console.log('\n9. Filesystem Boundaries:');
    console.log('----------------------------------------');
    
    if (runningContainers[firstMysqlNode] && runningContainers[firstMysqlNode].state === 'running') {
        const [workspaceCheck, scratchCheck] = await Promise.all([
            dockerExecAsync(firstMysqlNode, ['ls', CONFIG.workspace.mcpPackageJson]),
            dockerExecAsync(firstMysqlNode, ['ls', '-d', CONFIG.workspace.scratchDir]),
        ]);

        if (workspaceCheck && !workspaceCheck.includes('No such file')) {
            console.log('✅ /workspace/mysql-mcp : Mounted successfully');
        } else {
            console.log('❌ /workspace/mysql-mcp : Missing or unreadable');
            up = false;
        }

        if (scratchCheck && !scratchCheck.includes('No such file')) {
            console.log('✅ /workspace/scratch   : Mounted successfully');
        } else {
            console.log('❌ /workspace/scratch   : Missing or unreadable');
            up = false;
        }
    } else {
        console.log('⚠️ Filesystem Boundaries: Skipped (mysql-node1 is not running)');
    }
    return up;
}

export async function runRoutingValidationSection(ctx) {
    const { firstMysqlNode, containers, mysqlRouterNode, dockerExecEnvAsync, dockerExecAsync, settled } = ctx;
    let up = true;
    
    console.log("\n4. Routing & Proxy Validation:");
    console.log("----------------------------------------");

    const { routerRW, routerRO, routerAPI, proxySQLAdmin, proxySQLData } = CONFIG.ports;
    const { proxyAdmin, proxyData, routerApi } = CONFIG.credentials;
    const { routerHttpCheckSec } = CONFIG.timeouts;

    if (!firstMysqlNode) throw new Error("No MySQL nodes found");
    const proxySqlNode = containers.find(c => c.includes("proxysql")) || "proxysql";
    const redisNode = containers.find(c => c.includes("redis")) || "redis-server";
    const datadogUnifiedNode = containers.find(c => c.includes("datadog")) || "datadog-unified";

    const [routerRWResult, routerROResult, routerAPIHTTPResult, routerAPIHTTPSResult, proxyBackendsResult, proxyDataResult, redisResult] = await Promise.allSettled([
        dockerExecEnvAsync(firstMysqlNode, [MYSQL_PWD_ENV], ["mysql", "-h", mysqlRouterNode, "-P", routerRW, MYSQL_USER_FLAG, "-N", "-s", "-e", "SELECT @@hostname;"]),
        dockerExecEnvAsync(firstMysqlNode, [MYSQL_PWD_ENV], ["mysql", "-h", mysqlRouterNode, "-P", routerRO, MYSQL_USER_FLAG, "-N", "-s", "-e", "SELECT @@hostname;"]),
        dockerExecAsync(datadogUnifiedNode, ["curl", "-s", "-m", routerHttpCheckSec, `http://${mysqlRouterNode}:${routerAPI}${CONFIG.routerApiPath}`]),
        dockerExecAsync(datadogUnifiedNode, ["curl", "-sk", "-m", routerHttpCheckSec, "-u", `${routerApi.user}:${routerApi.password}`, `https://${mysqlRouterNode}:${routerAPI}${CONFIG.routerApiPath}`]),
        dockerExecEnvAsync(proxySqlNode, [`MYSQL_PWD=${proxyAdmin.password}`], ["mysql", "-h", "127.0.0.1", "-P", proxySQLAdmin, `-u${proxyAdmin.user}`, "-N", "-s", "-e", "SELECT hostgroup_id, hostname, status FROM runtime_mysql_servers ORDER BY hostgroup_id, hostname;"]),
        dockerExecEnvAsync(firstMysqlNode, [`MYSQL_PWD=${proxyData.password}`], ["mysql", "-h", "proxysql", "-P", proxySQLData, `-u${proxyData.user}`, "-N", "-s", "-e", "SELECT 1;"]),
        dockerExecAsync(redisNode, ["redis-cli", "PING"]),
    ]);

    const routerRW_val = settled(routerRWResult);
    if (routerRW_val && routerRW_val.trim().length > 0) {
        console.log(`✅ Router R/W (${routerRW})    : Routed to ${routerRW_val.trim()}`);
    } else {
        console.log(`❌ Router R/W (${routerRW})    : Cannot route queries`);
        up = false;
    }

    const routerRO_val = settled(routerROResult);
    if (routerRO_val && routerRO_val.trim().length > 0) {
        console.log(`✅ Router R/O (${routerRO})    : Routed to ${routerRO_val.trim()}`);
    } else {
        console.log(`❌ Router R/O (${routerRO})    : Cannot route queries`);
        up = false;
    }

    const routerAPIHTTP_val = settled(routerAPIHTTPResult);
    const routerAPIHTTPS_val = settled(routerAPIHTTPSResult);
    if (routerAPIHTTPS_val && routerAPIHTTPS_val.includes(CONFIG.routerApiResponseKey)) {
        if (routerAPIHTTP_val === null || routerAPIHTTP_val.trim() === "") {
            console.log("✅ Router REST API      : Responding securely (HTTPS enforced, HTTP rejected)");
        } else {
            console.log("⚠️ Router REST API      : Responding to HTTPS, but HTTP unexpectedly did not fail");
            up = false;
        }
    } else {
        console.log("❌ Router REST API      : Not responding to HTTPS");
        up = false;
    }

    const proxyBackends_val = settled(proxyBackendsResult);
    if (proxyBackends_val) {
        const lines = splitLines(proxyBackends_val.trim()).filter(Boolean);
        const offlineBackends = lines.filter(l => !l.includes("ONLINE"));
        if (offlineBackends.length === 0 && lines.length > 0) {
            console.log(`✅ ProxySQL backends    : ${lines.length} backends, all ONLINE`);
        } else if (lines.length > 0) {
            console.log(`⚠️ ProxySQL backends    : ${offlineBackends.length}/${lines.length} backends NOT ONLINE`);
            offlineBackends.forEach(line => console.log(`   ${line}`));
            up = false;
        } else {
            console.log("❌ ProxySQL backends    : No backends configured");
            up = false;
        }
    } else {
        console.log(`❌ ProxySQL admin       : Cannot connect to admin interface (${proxySQLAdmin})`);
        up = false;
    }

    const proxyData_val = settled(proxyDataResult);
    if (proxyData_val && proxyData_val.trim() === "1") {
        console.log(`✅ ProxySQL data (${proxySQLData}) : Routing queries successfully`);
    } else {
        console.log(`❌ ProxySQL data (${proxySQLData}) : Cannot route queries`);
        up = false;
    }

    const redisPing_val = settled(redisResult);
    if (redisPing_val && redisPing_val.trim() === "PONG") {
        const redisSet = await dockerExecAsync(redisNode, ["redis-cli", "SET", CONFIG.redis.healthKey, CONFIG.redis.healthValue, "EX", CONFIG.redis.healthTtlSec]);
        const redisGet = await dockerExecAsync(redisNode, ["redis-cli", "GET", CONFIG.redis.healthKey]);
        if (redisSet && redisSet.trim() === "OK" && redisGet && redisGet.trim() === CONFIG.redis.healthValue) {
            console.log("✅ Redis                : PING + SET/GET cycle passed");
        } else {
            console.log("⚠️ Redis                : PING ok but SET/GET failed");
            up = false;
        }
    } else {
        console.log("❌ Redis                : Not responding to PING");
        up = false;
    }

    return up;
}

export async function runObservabilityStackSection(ctx) {
    const { datadogUnifiedNode, prometheusNode, dockerExecAsync, settled, safeParse } = ctx;
    let up = true;

    console.log("\n5. Observability Stack:");
    console.log("----------------------------------------");

    const { curlSec } = CONFIG.timeouts;

    const [promHealthResult, grafanaHealthResult, lokiReadyResult, alloyReadyResult] = await Promise.allSettled([
        dockerExecAsync(prometheusNode, ["wget", "-qO-", "http://localhost:9090/-/healthy"]),
        dockerExecAsync(datadogUnifiedNode, ["curl", "-s", "--connect-timeout", curlSec, `http://grafana:${CONFIG.ports.grafana}/api/health`]),
        dockerExecAsync(datadogUnifiedNode, ["curl", "-s", "--connect-timeout", curlSec, `http://loki:${CONFIG.ports.loki}/ready`]),
        dockerExecAsync(datadogUnifiedNode, ["curl", "-s", "--connect-timeout", curlSec, `http://alloy:${CONFIG.ports.alloy}/-/ready`]),
    ]);

    const promHealth = settled(promHealthResult);
    if (promHealth && promHealth.includes("Healthy")) {
        const promTargets = await dockerExecAsync(prometheusNode, ["wget", "-qO-", `http://localhost:${CONFIG.ports.prometheus}/api/v1/targets?state=active`]);
        if (promTargets) {
            const parsed = safeParse(promTargets);
            if (parsed.ok) {
                const activeTargets = parsed.data?.data?.activeTargets || [];
                const downTargets = activeTargets.filter(t => t.health !== "up");
                if (downTargets.length === 0 && activeTargets.length > 0) {
                    console.log(`✅ Prometheus           : Healthy, ${activeTargets.length} target(s) all UP`);
                } else if (activeTargets.length === 0) {
                    console.log("⚠️ Prometheus           : Healthy but no active scrape targets");
                    up = false;
                } else {
                    console.log(`⚠️ Prometheus           : ${downTargets.length}/${activeTargets.length} target(s) DOWN`);
                    downTargets.forEach(t => console.log(`   ❌ ${t.labels?.job || "unknown"}/${t.labels?.instance || "unknown"}: ${t.lastError || "unknown error"}`));
                    up = false;
                }
            } else {
                console.log("✅ Prometheus           : Healthy (targets API parse failed, non-critical)");
            }
        } else {
            console.log("✅ Prometheus           : Healthy (targets check skipped)");
        }
    } else {
        console.log("❌ Prometheus           : Not healthy");
        up = false;
    }

    const grafanaHealth = settled(grafanaHealthResult);
    if (grafanaHealth) {
        const parsed = safeParse(grafanaHealth);
        if (parsed.ok && parsed.data) {
            if (parsed.data.database === "ok") {
                console.log("✅ Grafana              : Healthy (database: ok)");
            } else {
                console.log(`⚠️ Grafana              : Responding but database: ${parsed.data.database || "unknown"}`);
                up = false;
            }
        } else {
            console.log("✅ Grafana              : Responding");
        }
    } else {
        console.log("❌ Grafana              : Not responding");
        up = false;
    }

    const lokiReady = settled(lokiReadyResult);
    if (lokiReady && lokiReady.toLowerCase().includes("ready")) {
        const lokiLabels = await dockerExecAsync(datadogUnifiedNode, ["curl", "-s", "--connect-timeout", curlSec, `http://loki:${CONFIG.ports.loki}/loki/api/v1/labels`]);
        let labelCount = 0;
        if (lokiLabels) {
            const parsed = safeParse(lokiLabels);
            if (parsed.ok) labelCount = parsed.data?.data?.length || 0;
        }
        if (labelCount > 0) {
            console.log(`✅ Loki                 : Ready (${labelCount} label(s) indexed — Alloy pipeline active)`);
        } else {
            console.log("✅ Loki                 : Ready (no labels yet — normal on fresh start)");
        }
    } else {
        console.log("❌ Loki                 : Not ready");
        up = false;
    }

    const alloyReady = settled(alloyReadyResult);
    if (alloyReady && alloyReady.toLowerCase().includes("ready")) {
        console.log("✅ Alloy                : Ready");
    } else {
        console.log("❌ Alloy                : Not ready");
        up = false;
    }

    return up;
}

export function runDatadogIntegrationSection(ctx) {
    const { runningContainers, datadogUnifiedNode, dockerExec } = ctx;
    let up = true;
    let ddStatusOut = null;

    console.log("\n6. Datadog Integration Status:");
    console.log("----------------------------------------");

    const ddDockerStatus = runningContainers[datadogUnifiedNode]?.status ?? "";
    const ddContainerHealthy = ddDockerStatus.includes("healthy") && !ddDockerStatus.includes("unhealthy");

    if (ddContainerHealthy) {
        ddStatusOut = dockerExec(datadogUnifiedNode, ["agent", "status"], true);
        if (ddStatusOut) {
            const { errorInstances, warningInstances, okInstances } = splitLines(ddStatusOut).reduce(
                (acc, l) => {
                    if (!l.includes("Instance ID:")) return acc;
                    if (l.includes("[ERROR]"))        acc.errorInstances.push(l);
                    else if (l.includes("[WARNING]")) acc.warningInstances.push(l);
                    else if (l.includes("[OK]"))      acc.okInstances.push(l);
                    return acc;
                },
                { errorInstances: [], warningInstances: [], okInstances: [] }
            );

            if (errorInstances.length === 0 && warningInstances.length === 0 && okInstances.length > 0) {
                console.log(`✅ Datadog Agent        : Healthy, ${okInstances.length} integration checks all OK`);
            } else if (okInstances.length === 0 && errorInstances.length === 0) {
                console.log("✅ Datadog Agent        : Healthy (integration checks still initializing)");
            } else {
                if (errorInstances.length > 0) {
                    console.log(`❌ Datadog Agent        : ${errorInstances.length} integration ERROR(s)`);
                    errorInstances.forEach(line => {
                        const match = line.match(/Instance ID:s*(.+?)s*[ERROR]/);
                        console.log(`   ❌ ${match ? match[1].trim() : line.trim()}`);
                    });
                    up = false;
                }
                if (warningInstances.length > 0) {
                    console.log(`⚠️  Datadog Agent        : ${warningInstances.length} integration WARNING(s)`);
                    warningInstances.forEach(line => {
                        const match = line.match(/Instance ID:s*(.+?)s*[WARNING]/);
                        console.log(`   ⚠️  ${match ? match[1].trim() : line.trim()}`);
                    });
                }
                if (okInstances.length > 0) {
                    console.log(`   ✅ ${okInstances.length} other checks OK`);
                }
            }
        } else {
            console.log("✅ Datadog Agent        : Docker-healthy (integration status temporarily unavailable)");
        }
    } else {
        console.log("❌ Datadog Agent        : Not healthy");
        up = false;
    }

    return { up, ddStatusOut };
}

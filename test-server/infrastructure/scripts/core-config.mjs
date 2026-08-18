import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ECOSYSTEM_ROOT = path.resolve(__dirname, '..');

export const CONFIG = {
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
        mysqlMcpDist: path.resolve(__dirname, '../../../../mysql-mcp/dist'),
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
    metrics: {
        gracePeriodSec: 60,
        imageFreshnessHours: 24,
        requiredFamilies: [
            'gen_ai_usage_prompt_tokens_per_call',
        ],
    },
};

export const MYSQL_PWD_ENV = `MYSQL_PWD=${CONFIG.credentials.mysql.password}`;
export const MYSQL_USER_FLAG = `-u${CONFIG.credentials.mysql.user}`;

export const splitLines = (str) => str.split(/\r?\n/);

export const safeParse = (raw) => {
    try { return { ok: true, data: JSON.parse(raw) }; }
    catch { return { ok: false, data: null }; }
};

export const stripMysqlWarning = (val) => {
    if (!val) return null;
    const trimmed = val.trim();
    if (!trimmed.includes('mysql: [Warning]')) return trimmed;
    return splitLines(trimmed).filter(l => !l.startsWith('mysql: [Warning]')).pop()?.trim() ?? trimmed;
};

export const settled = (result) => result.status === 'fulfilled' ? result.value : null;

export const EXEC_ENV = Object.freeze({ ...process.env, LC_ALL: 'C', LANG: 'C' });

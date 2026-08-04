import { execFile } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { promisify } from 'util';
import { resolveScriptPaths } from './utils.mjs';

const execFileAsync = promisify(execFile);
const { ecosystemRoot, adamicRoot } = resolveScriptPaths(import.meta.url);

const dashboards = [
    { id: "qwe-2un-us8", file: "datadog-tool-performance.json" },
    { id: "q48-mq9-3i7", file: "datadog-ai-efficiency.json" },
    { id: "h74-9g7-8bv", file: "datadog-infrastructure.json" },
    { id: "j8f-g47-xtc", file: "datadog-logs.json" },
    { id: "4w2-tdx-wf7", file: "datadog-mysql.json" },
    { id: "khx-zry-d49", file: "datadog-redis.json" }
];

const targetDirs = [
    join(ecosystemRoot, 'config'),
    join(adamicRoot, '..', 'mysql-mcp', 'test-server', 'infrastructure', 'config'),
    join(adamicRoot, '..', 'mysql-mcp', 'examples', 'dashboards')
];

// Precompute existing directories to avoid redundant stat calls
const existingDirs = targetDirs.filter(dir => existsSync(dir));
const JQ_FILTER = "{title, description, widgets, template_variables, layout_type, notify_list, pause_auto_refresh, reflow_type}";

async function fetchAndSaveDashboard(dashboard) {
    console.log(`Downloading dashboard ${dashboard.file} (${dashboard.id})...`);
    try {
        const { stdout } = await execFileAsync('pup', [
            'dashboards', 'get', dashboard.id,
            '-o', 'json',
            '--jq', JQ_FILTER
        ], { encoding: 'utf-8' });
        
        for (const dir of existingDirs) {
            const dest = join(dir, dashboard.file);
            writeFileSync(dest, stdout, 'utf-8');
            console.log(`  -> Saved to ${dest}`);
        }
    } catch (error) {
        console.error(`Failed to download ${dashboard.id}:`, error.message);
        throw error;
    }
}

async function main() {
    try {
        await Promise.all(dashboards.map(fetchAndSaveDashboard));
        console.log("Dashboards backup complete.");
    } catch (error) {
        console.error("Backup failed due to one or more errors.");
        process.exit(1);
    }
}

main();

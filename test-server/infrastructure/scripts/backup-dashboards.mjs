import { execSync } from 'child_process';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { resolveScriptPaths } from './utils.mjs';

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

for (const dashboard of dashboards) {
    console.log(`Downloading dashboard ${dashboard.file} (${dashboard.id})...`);
    
    // Download and parse JSON using pup
    const pupCommand = `pup dashboards get ${dashboard.id} -o json --jq "{title, description, widgets, template_variables, layout_type, notify_list, pause_auto_refresh, reflow_type}"`;
    
    try {
        const dashboardJson = execSync(pupCommand, { encoding: 'utf-8' });
        
        for (const dir of targetDirs) {
            if (existsSync(dir)) {
                const dest = join(dir, dashboard.file);
                writeFileSync(dest, dashboardJson, 'utf-8');
                console.log(`  -> Saved to ${dest}`);
            }
        }
    } catch (error) {
        console.error(`Failed to download ${dashboard.id}:`, error.message);
        process.exit(1);
    }
}

console.log("Dashboards backup complete.");

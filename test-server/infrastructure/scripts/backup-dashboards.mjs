import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { resolveScriptPaths } from './utils.mjs';

const execAsync = promisify(exec);

const { ecosystemRoot, adamicRoot } = resolveScriptPaths(import.meta.url);
const mysqlMcpRoot = join(adamicRoot, '..', 'mysql-mcp');

const dashboards = [
    { id: "qwe-2un-us8", file: "datadog-tool-performance.json" },
    { id: "q48-mq9-3i7", file: "datadog-ai-efficiency.json" },
    { id: "my6-q9k-682", file: "datadog-infrastructure.json" },
    { id: "79q-b3r-jhu", file: "datadog-logs.json" },
    { id: "4w2-tdx-wf7", file: "datadog-mysql.json" },
    { id: "khx-zry-d49", file: "datadog-redis.json" },
    { id: "zi7-trq-jia", file: "lib-agent-exec.json" },
    { id: "xij-4r3-br8", file: "datadog-dashboard.json" }
];

const targetDirs = [
    join(ecosystemRoot, 'config'),
    join(mysqlMcpRoot, 'test-server', 'infrastructure', 'config'),
    join(mysqlMcpRoot, 'examples', 'dashboards')
];

const adamicChanged = [];
const mysqlMcpChanged = [];

for (const dashboard of dashboards) {
    console.log(`Downloading dashboard ${dashboard.file} (${dashboard.id})...`);
    
    // Download and parse JSON using pup
    const pupCommand = `pup dashboards get ${dashboard.id} -o json --jq "{title, description, widgets, template_variables, layout_type, notify_list, pause_auto_refresh, reflow_type}"`;
    
    try {
        const { stdout: dashboardJson } = await execAsync(pupCommand, { encoding: 'utf-8' });
        
        for (const dir of targetDirs) {
            if (existsSync(dir)) {
                const dest = join(dir, dashboard.file);
                let changed = true;
                
                try {
                    const existing = readFileSync(dest, 'utf-8');
                    if (existing === dashboardJson) {
                        changed = false;
                    }
                } catch (e) {
                    if (e.code !== 'ENOENT') throw e;
                }
                
                if (changed) {
                    writeFileSync(dest, dashboardJson, 'utf-8');
                    console.log(`  -> Saved to ${dest}`);
                    
                    if (dest.includes('mysql-mcp')) {
                        mysqlMcpChanged.push(relative(mysqlMcpRoot, dest).replace(/\\/g, '/'));
                    } else {
                        adamicChanged.push(relative(adamicRoot, dest).replace(/\\/g, '/'));
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Failed to download ${dashboard.id}:`, error.message);
        process.exit(1);
    }
}

if (adamicChanged.length > 0) {
    console.log(`\nAuto-committing dashboard updates for adamic: ${adamicChanged.join(", ")}`);
    const commitScript = join(adamicRoot, ".agents", "scripts", "commit.ts");
    const addArgs = adamicChanged.map(f => `--add "${f}"`).join(" ");
    const cmd = `bun "${commitScript}" --msg "chore(observability): backup datadog dashboards" --impact 0.1 --confidence 1.0 --validation passed --journal ${addArgs}`;
    
    try {
        execSync(cmd, { stdio: "inherit", cwd: adamicRoot });
    } catch (err) {
        console.error("Failed to auto-commit in adamic:", err.message || err);
        process.exit(1);
    }
}

if (mysqlMcpChanged.length > 0) {
    console.log(`\nAuto-committing dashboard updates for mysql-mcp: ${mysqlMcpChanged.join(", ")}`);
    const commitScript = join(mysqlMcpRoot, ".agents", "scripts", "commit.ts");
    const addArgs = mysqlMcpChanged.map(f => `--add "${f}"`).join(" ");
    const cmd = `bun "${commitScript}" --msg "chore(observability): sync datadog dashboards from adamic" --impact 0.1 --confidence 1.0 --validation passed --journal ${addArgs}`;
    
    try {
        execSync(cmd, { stdio: "inherit", cwd: mysqlMcpRoot });
    } catch (err) {
        console.error("Failed to auto-commit in mysql-mcp:", err.message || err);
        process.exit(1);
    }
}

console.log("\nDashboards backup complete.");

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { resolveScriptPaths } from './utils.mjs';

const { ecosystemRoot } = resolveScriptPaths(import.meta.url);

const dashboards = [
    { id: "qwe-2un-us8", file: "datadog-tool-performance.json" },
    { id: "q48-mq9-3i7", file: "datadog-ai-efficiency.json" },
    { id: "hb6-7ex-vq7", file: "datadog-infrastructure.json" },
    { id: "h3a-dp2-4re", file: "datadog-logs.json" },
    { id: "4w2-tdx-wf7", file: "datadog-mysql.json" },
    { id: "khx-zry-d49", file: "datadog-redis.json" },
    { id: "zi7-trq-jia", file: "lib-agent-exec.json" }
];

const configDir = join(ecosystemRoot, 'config');

for (const dashboard of dashboards) {
    console.log(`Uploading dashboard ${dashboard.file} (${dashboard.id})...`);
    const sourceFile = join(configDir, dashboard.file);

    if (existsSync(sourceFile)) {
        try {
            execSync(`pup dashboards update ${dashboard.id} --file "${sourceFile}" -y`, { stdio: 'inherit' });
            console.log(`  -> Successfully uploaded.`);
        } catch (error) {
            console.error(`  -> Error uploading ${dashboard.file}: ${error.message}`);
            process.exit(1);
        }
    } else {
        console.warn(`  -> Warning: File ${sourceFile} not found. Skipping.`);
    }
}

console.log("Dashboards upload complete.");

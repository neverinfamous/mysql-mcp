import fs from 'fs';
import path from 'path';

const toolMapPath = 'C:/Users/chris/Desktop/mysql-mcp/test-server/scripts/tool-map.json';
const toolMap = JSON.parse(fs.readFileSync(toolMapPath, 'utf8'));

const ssotPath = 'C:/Users/chris/.gemini/antigravity/brain/f490522f-cb80-48c7-8ff3-dec1ac70f890/scratch/ssot-mapping.md';
const ssotLines = fs.readFileSync(ssotPath, 'utf8').split('\n');
const validTools = new Set();
for (const line of ssotLines) {
    if (line.startsWith('- ')) {
        validTools.add(line.slice(2).trim());
    }
}

const dirPath = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability-direct';
const files = fs.readdirSync(dirPath).filter(f => f.startsWith('test-usability-direct-') && f.endsWith('.md'));

let hasError = false;
const coverage = new Set();

for (const file of files) {
    if (!toolMap[file]) {
        console.log(`Missing from tool-map.json: ${file}`);
        hasError = true;
    } else {
        const tools = toolMap[file];
        if (tools.length > 3) {
            console.log(`Too many tools in ${file}: ${tools.length}`);
            hasError = true;
        }
        for (const t of tools) {
            if (!validTools.has(t)) {
                console.log(`Hallucinated tool in ${file}: ${t}`);
                hasError = true;
            }
            if (coverage.has(t)) {
                console.log(`Overlap in ${file}: ${t} is already tested`);
                hasError = true;
            }
            coverage.add(t);
        }
    }
}

for (const t of validTools) {
    if (!coverage.has(t)) {
        console.log(`Missing coverage for tool: ${t}`);
        hasError = true;
    }
}

if (!hasError) {
    console.log("All good!");
}

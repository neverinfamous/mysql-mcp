import fs from 'fs';

const ssotPath = 'C:/Users/chris/.gemini/antigravity/brain/7faf2655-1fdb-48b3-a4b3-f081a5b80ed0/scratch/ssot-mapping.md';
const toolMapPath = 'C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json';

const ssotContent = fs.readFileSync(ssotPath, 'utf-8');
const toolMap = JSON.parse(fs.readFileSync(toolMapPath, 'utf-8'));

const ssotTools = new Set();
for (const line of ssotContent.split('\n')) {
  if (line.trim().startsWith('- `')) {
    const tool = line.trim().replace('- `', '').replace('`', '');
    ssotTools.add(tool);
  }
}

const mapTools = new Set();
for (const [file, tools] of Object.entries(toolMap)) {
  for (const t of tools) {
    mapTools.add(t);
  }
}

console.log("Tools in SSoT but missing from tool-map.json:");
let missingCount = 0;
for (const t of ssotTools) {
  if (!mapTools.has(t)) {
    console.log(`- ${t}`);
    missingCount++;
  }
}

if (missingCount === 0) {
  console.log("No tools missing.");
}

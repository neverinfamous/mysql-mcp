import fs from 'fs';
const ssot = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/4653e757-17ba-4848-8202-7f8fc6076389/scratch/ssot-mapping.md', 'utf-8');
const toolMap = JSON.parse(fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json', 'utf-8'));

const ssotTools = new Set();
for (const line of ssot.split('\n')) {
  if (line.startsWith('- ')) ssotTools.add(line.slice(2).trim());
}

const mapList = [];
for (const file in toolMap) {
  if (!file.startsWith('test-codemode') && !file.startsWith('test-advanced') && !file.startsWith('test-usability')) {
    for (const tool of toolMap[file]) {
      mapList.push({tool, file});
    }
  }
}

const mapTools = new Set(mapList.map(i => i.tool));

console.log('--- GAPS (In SSoT but not in basic test-tool-groups) ---');
for (const t of ssotTools) {
  if (!mapTools.has(t)) console.log(t);
}

console.log('--- EXTRAS (In basic test-tool-groups but not in SSoT) ---');
for (const t of mapTools) {
  if (!ssotTools.has(t)) console.log(t);
}

console.log('--- OVERLAPS (Tool appears multiple times within basic test-tool-groups) ---');
const toolCounts = {};
for (const item of mapList) {
  toolCounts[item.tool] = (toolCounts[item.tool] || 0) + 1;
}
for (const t in toolCounts) {
  if (toolCounts[t] > 1) {
    const files = mapList.filter(i => i.tool === t).map(i => i.file);
    console.log(t + ' in: ' + files.join(', '));
  }
}

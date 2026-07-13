const fs = require('fs');
const toolMap = JSON.parse(fs.readFileSync('test-server/scripts/tool-map.json'));
const files = fs.readdirSync('test-server/test-tool-groups').filter(f => f.endsWith('.md') && f.startsWith('test-'));

const ssot = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/a01ba777-c022-43ca-8b0b-c58977a8827c/scratch/ssot-mapping.md', 'utf-8');
const allTools = new Set();
for (const line of ssot.split('\n')) {
  if (line.startsWith('- mysql')) allTools.add(line.slice(2).trim());
  if (line.startsWith('- proxysql')) allTools.add(line.slice(2).trim());
}

const mapTools = new Set();
for (const file of files) {
  if (!toolMap[file]) {
    console.log('Missing file in tool-map.json: ' + file);
  } else {
    for (const tool of toolMap[file]) {
      mapTools.add(tool);
    }
  }
}

for (const tool of allTools) {
  if (!mapTools.has(tool)) {
    console.log('Missing tool in test-tool-groups mapping: ' + tool);
  }
}

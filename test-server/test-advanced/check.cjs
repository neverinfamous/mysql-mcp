const fs = require('fs');

const ssot = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/3cd8c70c-b206-4dc3-8955-95d026817a40/scratch/ssot-mapping.md', 'utf8');
const map = JSON.parse(fs.readFileSync('tools_map4.json', 'utf8'));

const ssotTools = new Set();
const lines = ssot.split('\n');
for (let line of lines) {
  if (line.startsWith('- **')) {
    const parts = line.split(':');
    if (parts.length > 1) {
      const tools = parts[1].split(',').map(t => t.trim());
      for (let tool of tools) {
        ssotTools.add(tool);
      }
    }
  }
}

const mapTools = new Set();
for (let file in map) {
  for (let tool of map[file]) {
    if (tool !== 'NO MATCH') {
      mapTools.add(tool);
    }
  }
}

const missingInMap = [...ssotTools].filter(t => !mapTools.has(t));
const extraInMap = [...mapTools].filter(t => !ssotTools.has(t));

console.log("Missing in tests:", missingInMap);
console.log("Extra in tests:", extraInMap);

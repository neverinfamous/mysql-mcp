const fs = require('fs');

const ssot = fs.readFileSync('c:/Users/chris/.gemini/antigravity/brain/5b55d91c-b676-4739-a598-bff293db3681/scratch/ssot-mapping.md', 'utf8');
const toolMap = JSON.parse(fs.readFileSync('c:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json', 'utf8'));

// Extract tools from SSOT
const ssotTools = new Set();
const lines = ssot.split('\n');
for (const line of lines) {
  if (line.startsWith('- **') && !line.includes('codemode')) {
    const parts = line.split(':');
    if (parts.length > 1) {
      const tools = parts[1].split(',').map(t => t.trim());
      tools.forEach(t => ssotTools.add(t));
    }
  }
}

// Extract codemode tests
const codemodeTools = new Map();
for (const [file, tools] of Object.entries(toolMap)) {
  if (file.startsWith('test-codemode-') && !file.startsWith('test-codemode-advanced-')) {
    for (const tool of tools) {
      if (!codemodeTools.has(tool)) codemodeTools.set(tool, []);
      codemodeTools.get(tool).push(file);
    }
  }
}

const missing = [];
for (const tool of ssotTools) {
  if (!codemodeTools.has(tool)) missing.push(tool);
}

const duplicate = [];
for (const [tool, files] of codemodeTools.entries()) {
  if (files.length > 1) duplicate.push({tool, files});
}

console.log('Missing tools:', missing);
console.log('Duplicate tools:', duplicate);

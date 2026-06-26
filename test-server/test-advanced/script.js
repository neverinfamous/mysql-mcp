const fs = require('fs');
const ssot = fs.readFileSync('C:\\Users\\chris\\.gemini\\antigravity\\brain\\d0fb73c9-b3fa-4c70-82e3-a08ead3e8c67\\scratch\\ssot-mapping.md', 'utf8');

const tools = new Set();
for (const line of ssot.split('\n')) {
  if (line.includes('| **')) {
    const parts = line.split('|');
    if (parts.length > 2) {
      const match = parts[2].match(/\([^\]+)\/g);
      if (match) {
        match.forEach(m => tools.add(m.replace(/\/g, '')));
      }
    }
  }
}

const files = fs.readdirSync('.').filter(f => f.endsWith('.md') && !['README.md', 'coordinator-workflow.md'].includes(f));
const foundTools = new Set();

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const regex = /(mysql|mysqlsh|proxysql)_[a-zA-Z0-9_]+/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    foundTools.add(match[0]);
  }
}

const missing = [];
for (const tool of tools) {
  if (!foundTools.has(tool)) {
    missing.push(tool);
  }
}

console.log('Total tools in SSoT:', tools.size);
console.log('Total tools found in tests:', foundTools.size);
console.log('Missing tools:', missing);

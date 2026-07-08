const fs = require('fs');
const path = require('path');

const ssotPath = 'C:\\Users\\chris\\.gemini\\antigravity\\brain\\d68fb2ee-5215-4900-bdef-d1c4edd2c400\\scratch\\ssot-mapping.md';
const testDir = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-codemode';

const ssotContent = fs.readFileSync(ssotPath, 'utf8');
const ssotTools = new Set();
const ssotGroups = {};

// Parse SSoT
const lines = ssotContent.split('\n');
let inTable = false;
for (const line of lines) {
  if (line.includes('| Group | Tools |')) {
    inTable = true;
    continue;
  }
  if (inTable && line.startsWith('| `')) {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length >= 3) {
      const groupStr = parts[1];
      const toolsStr = parts[2];
      
      const groupMatch = groupStr.match(/`([^`]+)`/);
      const group = groupMatch ? groupMatch[1] : null;
      
      if (group) {
        ssotGroups[group] = [];
        const regex = /`([^`]+)`/g;
        let match;
        while ((match = regex.exec(toolsStr)) !== null) {
          ssotTools.add(match[1]);
          ssotGroups[group].push(match[1]);
        }
      }
    }
  }
}

// Parse Test Files
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.md') && f.startsWith('test-codemode-'));
const testedTools = new Set();
const fileToTools = {};
const hallucinatedTools = [];

for (const file of testFiles) {
  const content = fs.readFileSync(path.join(testDir, file), 'utf8');
  const explicitSection = content.split('### Explicit Tool Coverage Requirements')[1];
  
  fileToTools[file] = [];
  if (explicitSection) {
    const lines = explicitSection.split('\n');
    for (const line of lines) {
      if (line.startsWith('- `')) {
        const match = line.match(/`([^`]+)`/);
        if (match) {
          const tool = match[1];
          testedTools.add(tool);
          fileToTools[file].push(tool);
          if (!ssotTools.has(tool)) {
            hallucinatedTools.push({ tool, file });
          }
        }
      }
    }
  }
}

const missingTools = [];
for (const tool of ssotTools) {
  if (!testedTools.has(tool)) {
    missingTools.push(tool);
  }
}

console.log('--- SSoT Tools Count:', ssotTools.size);
console.log('--- Tested Tools Count:', testedTools.size);
console.log('--- Missing Tools from Tests:');
console.log(missingTools);
console.log('--- Hallucinated Tools in Tests:');
console.log(hallucinatedTools);

console.log('--- Files with > 5 tools:');
for (const [file, tools] of Object.entries(fileToTools)) {
  if (tools.length > 5) {
    console.log(`${file}: ${tools.length} tools`, tools);
  }
}

console.log('--- Files with 4 or 5 tools (potential split):');
for (const [file, tools] of Object.entries(fileToTools)) {
  if (tools.length >= 4 && tools.length <= 5) {
    console.log(`${file}: ${tools.length} tools`, tools);
  }
}

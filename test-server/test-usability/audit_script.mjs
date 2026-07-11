import fs from 'fs';
import path from 'path';

const ssotContent = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/ad3b56bb-56ab-4391-9ef6-9ab4b2507041/scratch/ssot-mapping.md', 'utf-8');
const toolsToGroup = new Map();
let currentGroup = '';

for (const line of ssotContent.split('\n')) {
  if (line.startsWith('### ')) {
    currentGroup = line.replace('### ', '').trim();
  } else if (line.startsWith('- ')) {
    const tool = line.replace('- ', '').trim();
    toolsToGroup.set(tool, currentGroup);
  }
}

const testDir = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability';
const files = fs.readdirSync(testDir).filter(f => f.startsWith('test-usability-'));

const coveredTools = new Set();
const fileToolMap = new Map();

for (const file of files) {
  const content = fs.readFileSync(path.join(testDir, file), 'utf-8');
  fileToolMap.set(file, []);
  for (const tool of toolsToGroup.keys()) {
    if (content.includes(tool)) {
      coveredTools.add(tool);
      fileToolMap.get(file).push(tool);
    }
  }
}

const missingTools = [];
for (const tool of toolsToGroup.keys()) {
  if (!coveredTools.has(tool)) {
    missingTools.push(tool);
  }
}

console.log('Missing tools:', missingTools);
console.log('Total tools in SSoT:', toolsToGroup.size);
console.log('Total tools covered:', coveredTools.size);

// Check coordinator-workflow.md queue
const coordContent = fs.readFileSync(path.join(testDir, 'coordinator-workflow.md'), 'utf-8');
const coordMatches = [...coordContent.matchAll(/[0-9]+\.\s+`([^`]+)`/g)].map(m => m[1]);

const missingInCoord = files.filter(f => !coordMatches.includes(f));
const extraInCoord = coordMatches.filter(f => !files.includes(f));
console.log('Missing in coord queue:', missingInCoord);
console.log('Extra in coord queue (not on disk):', extraInCoord);
console.log('Files on disk:', files.length, 'Files in coord:', coordMatches.length);

const fs = require('fs');

const toolMap = JSON.parse(fs.readFileSync('c:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json', 'utf8'));
const workflow = fs.readFileSync('c:/Users/chris/Desktop/mysql-mcp/test-server/test-codemode/coordinator-workflow.md', 'utf8');

const workflowFiles = new Set();
const match = workflow.match(/^\d+\.\s+`([^`]+)`/gm);
if (match) {
  match.forEach(m => {
    workflowFiles.add(m.match(/`([^`]+)`/)[1]);
  });
}

const mapFiles = new Set();
for (const file of Object.keys(toolMap)) {
  if (file.startsWith('test-codemode-') && !file.startsWith('test-codemode-advanced-')) {
    mapFiles.add(file);
  }
}

const missingInMap = [...workflowFiles].filter(f => !mapFiles.has(f) && f !== 'test-codemode-sandbox.md');
const missingInWorkflow = [...mapFiles].filter(f => !workflowFiles.has(f));

console.log('Missing in map:', missingInMap);
console.log('Missing in workflow:', missingInWorkflow);

const fs = require('fs');
const dir = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-tool-groups';
const files = fs.readdirSync(dir);
const testFiles = files.filter(f => f.startsWith('test-') && f.endsWith('.md'));
const phaseFiles = files.filter(f => f.startsWith('coordinator-workflow-phase'));

let referencedFiles = new Set();
let duplicates = [];
let phaseContents = {};

phaseFiles.forEach(pf => {
  const content = fs.readFileSync(dir + '/' + pf, 'utf8');
  phaseContents[pf] = content;
  const matches = Array.from(content.matchAll(/- `([a-zA-Z0-9-]+\.md)`/g)).map(m => m[1]);
  matches.forEach(m => {
    if (referencedFiles.has(m)) duplicates.push(m);
    referencedFiles.add(m);
  });
});

const unreferenced = testFiles.filter(f => !referencedFiles.has(f));
const missingOnDisk = Array.from(referencedFiles).filter(f => !testFiles.includes(f));

console.log('Unreferenced test files:', unreferenced);
console.log('Referenced files missing on disk:', missingOnDisk);
console.log('Duplicates in queues:', duplicates);

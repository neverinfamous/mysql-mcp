const fs = require('fs');

const files = fs.readdirSync('test-server/test-tool-groups').filter(f => f.endsWith('.md') && f.startsWith('test-'));

const phases = fs.readdirSync('test-server/test-tool-groups').filter(f => f.startsWith('coordinator-workflow-phase'));
const phaseFiles = new Set();
for (const phase of phases) {
  const content = fs.readFileSync('test-server/test-tool-groups/' + phase, 'utf-8');
  for (const line of content.split('\n')) {
    const match = line.match(/`test-.*?\.md`/);
    if (match) {
      phaseFiles.add(match[0].slice(1, -1));
    }
  }
}

let differences = false;
console.log('Files on disk not in phases:');
for (const f of files) {
  if (!phaseFiles.has(f)) {
    console.log(f);
    differences = true;
  }
}

console.log('Files in phases not on disk:');
for (const f of phaseFiles) {
  if (!files.includes(f)) {
    console.log(f);
    differences = true;
  }
}

if (!differences) {
  console.log('Perfect match!');
}

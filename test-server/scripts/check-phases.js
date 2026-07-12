import fs from 'fs';
import path from 'path';

const dirPath = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability-direct';
const files = fs.readdirSync(dirPath).filter(f => f.startsWith('test-usability-direct-') && f.endsWith('.md'));

const phases = [
  'coordinator-workflow-phase1-foundation.md',
  'coordinator-workflow-phase2-admin.md',
  'coordinator-workflow-phase3-schema.md',
  'coordinator-workflow-phase4-analytics.md'
];

const foundInPhases = new Set();
let allGood = true;

for (const phase of phases) {
    const phasePath = path.join(dirPath, phase);
    if (!fs.existsSync(phasePath)) continue;
    const content = fs.readFileSync(phasePath, 'utf8');
    const matches = [...content.matchAll(/\- \[([^\]]+)\]\(([^)]+)\)/g)];
    
    let count = 0;
    for (const match of matches) {
        foundInPhases.add(match[2]);
        count++;
    }
    
    const yMatch = content.match(/Where Y is (\d+)/);
    if (yMatch) {
        const y = parseInt(yMatch[1], 10);
        if (y !== count) {
            console.log(`${phase}: Y is ${y} but has ${count} tests.`);
            allGood = false;
        }
    }
}

for (const file of files) {
    if (!foundInPhases.has(file)) {
        console.log(`Missing from phases: ${file}`);
        allGood = false;
    }
}

for (const f of foundInPhases) {
    if (!files.includes(f)) {
        console.log(`Listed in phase but does not exist: ${f}`);
        allGood = false;
    }
}

if (allGood) console.log("Phases match exactly!");

const fs = require('fs');
const path = require('path');

const dir = 'C:\\\\Users\\\\chris\\\\Desktop\\\\mysql-mcp\\\\test-server\\\\test-advanced';
const files = fs.readdirSync(dir).filter(f => f.startsWith('test-') && f.endsWith('.md')).sort();

// move sandbox to the end
const sandboxIndex = files.indexOf('test-codemode-sandbox.md');
if (sandboxIndex > -1) {
    files.splice(sandboxIndex, 1);
    files.push('test-codemode-sandbox.md');
}

// ensure core is first (or core-part1)
const corePart1Index = files.indexOf('test-codemode-advanced-core-part1.md');
if (corePart1Index > -1) {
    files.splice(corePart1Index, 1);
    files.unshift('test-codemode-advanced-core-part1.md');
}

const corePart2Index = files.indexOf('test-codemode-advanced-core-part2.md');
if (corePart2Index > -1) {
    files.splice(corePart2Index, 1);
    files.splice(1, 0, 'test-codemode-advanced-core-part2.md'); // put it second
}

let newList = files.map((f, i) => `${i + 1}. \`${f}\`${f === 'test-codemode-advanced-core-part1.md' ? ' (**MUST PASS FIRST**)' : ''}`).join('\n');

const wfPath = path.join(dir, 'coordinator-workflow.md');
let content = fs.readFileSync(wfPath, 'utf8');

// Replace the text
content = content.replace(/## Test Sequence Queue \(Dependency DAG\)[\s\S]*?## Telemetry Collection/, `## Test Sequence Queue (Dependency DAG)\n\n${newList}\n\n## Telemetry Collection`);

// Also update the total number
content = content.replace(/This is test X out of \d+\./g, `This is test X out of ${files.length}.`);

fs.writeFileSync(wfPath, content);
console.log('Updated coordinator workflow with', files.length, 'files');

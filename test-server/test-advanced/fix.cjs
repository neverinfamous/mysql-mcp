const fs = require('fs');
const path = require('path');

const testAdvancedDir = path.join('C:', 'Users', 'chris', 'Desktop', 'mysql-mcp', 'test-server', 'test-advanced');
const toolMapPath = path.join('C:', 'Users', 'chris', 'Desktop', 'mysql-mcp', 'test-server', 'scripts', 'tool-map.json');
const coordPath = path.join(testAdvancedDir, 'coordinator-workflow.md');
const standardizePath = path.join('C:', 'Users', 'chris', 'Desktop', 'mysql-mcp', 'test-server', 'scripts', 'standardize-prompts.js');

const renames = {
    'test-codemode-advanced-versioning-part1.md': 'test-codemode-advanced-core-part3a.md',
    'test-codemode-advanced-versioning-part2.md': 'test-codemode-advanced-core-part3b.md',
    'test-codemode-advanced-partitioninga.md': 'test-codemode-advanced-partitioning-part1.md',
    'test-codemode-advanced-partitioningb.md': 'test-codemode-advanced-partitioning-part2.md'
};

for (const [oldName, newName] of Object.entries(renames)) {
    const oldPath = path.join(testAdvancedDir, oldName);
    const newPath = path.join(testAdvancedDir, newName);
    if (fs.existsSync(oldPath)) {
        let content = fs.readFileSync(oldPath, 'utf-8');
        if (oldName.includes('versioning')) {
            content = content.replace(/\[versioning.*?\]/i, '[core-part3' + (oldName.includes('part1') ? 'a' : 'b') + ']');
        }
        if (oldName.includes('partitioning')) {
            content = content.replace(/\[partitioning.*?\]/i, '[partitioning-part' + (oldName.includes('partitioninga') ? '1' : '2') + ']');
        }
        fs.writeFileSync(newPath, content, 'utf-8');
        fs.unlinkSync(oldPath);
        console.log(`Renamed ${oldName} to ${newName}`);
    }
}

let toolMap = JSON.parse(fs.readFileSync(toolMapPath, 'utf-8'));
for (const [oldName, newName] of Object.entries(renames)) {
    if (toolMap[oldName]) {
        toolMap[newName] = toolMap[oldName];
        delete toolMap[oldName];
    }
}
fs.writeFileSync(toolMapPath, JSON.stringify(toolMap, null, 2), 'utf-8');
console.log('Updated tool-map.json');

let coordContent = fs.readFileSync(coordPath, 'utf-8');
let filesOnDisk = fs.readdirSync(testAdvancedDir).filter(f => f.startsWith('test-codemode-') && f.endsWith('.md')).sort();
let newQueue = '';
for (let i = 0; i < filesOnDisk.length; i++) {
    let f = filesOnDisk[i];
    if (f === 'test-codemode-advanced-admin-control-part1.md') {
        newQueue += `${i+1}. \`${f}\` (**MUST PASS FIRST**)\n`;
    } else {
        newQueue += `${i+1}. \`${f}\`\n`;
    }
}
coordContent = coordContent.replace(/1\. \`test-codemode-advanced-admin-control-part1\.md[\s\S]*?(?=\n\n## Telemetry|$)/, newQueue.trim());
fs.writeFileSync(coordPath, coordContent, 'utf-8');
console.log('Updated coordinator-workflow.md');

let standardizeContent = fs.readFileSync(standardizePath, 'utf-8');
standardizeContent = standardizeContent.replace(
    /if \(baseGroup\.startsWith\('sys-'\) \|\| baseGroup === 'sys'\) baseGroup = 'sysschema';/,
    `if (baseGroup.startsWith('sys-') || baseGroup === 'sys') baseGroup = 'sysschema';\n    if (baseGroup === 'partitioning-part1' || baseGroup === 'partitioning-part2') baseGroup = 'partitioning';\n    if (baseGroup.startsWith('core-part3')) baseGroup = 'core';`
);
fs.writeFileSync(standardizePath, standardizeContent, 'utf-8');
console.log('Updated standardize-prompts.js');

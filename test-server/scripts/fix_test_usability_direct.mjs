import fs from 'fs';
import path from 'path';

// Parse SSoT mapping
const ssotPath = 'C:\\Users\\chris\\.gemini\\antigravity\\brain\\02ad0508-d14c-4cf3-91b3-7411d795a3f6\\scratch\\ssot-mapping.md';
const ssotContent = fs.readFileSync(ssotPath, 'utf8');
const groupMap = {};

for (const line of ssotContent.split('\n')) {
  const match = line.match(/^- \*\*(\w+)\*\* \(\d+ tools\): (.+)$/);
  if (match) {
    const group = match[1];
    const tools = match[2].split(',').map(t => t.trim());
    groupMap[group] = tools;
  }
}

const dirPath = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-usability-direct';

let missingAdded = [];
let hallucinatedRemoved = [];
let filesModified = 0;
let modifiedFilesList = [];

for (const [group, tools] of Object.entries(groupMap)) {
  const numFiles = Math.ceil(tools.length / 3);
  for (let i = 1; i <= numFiles; i++) {
    const filename = group === 'codemode' ? 'test-usability-direct-codemode.md' : `test-usability-direct-${group}-part${i}.md`;
    const filepath = path.join(dirPath, filename);
    if (!fs.existsSync(filepath)) {
      console.log(`File not found: ${filename}`);
      continue;
    }
    
    const expectedTools = tools.slice((i - 1) * 3, i * 3);
    const content = fs.readFileSync(filepath, 'utf8');
    
    const existingToolsMatch = content.match(/\| `([^`]+)` \|/g);
    const existingTools = existingToolsMatch ? existingToolsMatch.map(m => m.match(/`([^`]+)`/)[1]) : [];
    
    const added = expectedTools.filter(t => !existingTools.includes(t));
    const removed = existingTools.filter(t => !expectedTools.includes(t));
    
    // Build new testContent
    let newTable = '| Tool | Fuzz Call | Hallucination Found | Fix Applied |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
    let newList = '### Explicit Tool Coverage Requirements\n\n**CRITICAL**: You MUST rigorously test every single tool listed below in this test pass. Ensure that realistic data scenarios, edge cases, and all error paths are validated for each tool:\n\n';
    
    for (const tool of expectedTools) {
      newTable += `| \`${tool}\` |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |   |\n`;
      newList += `- \`${tool}\`\n`;
    }
    
    newList += '\n\n\n\n---\n\n';
    
    const regex = /\| Tool \| Fuzz Call \| Hallucination Found \| Fix Applied \|[\s\S]*?(?=## Execute Post-Test Procedures)/;
    
    const newSection = newTable + '\n---\n\n' + newList;
    const newContent = content.replace(regex, newSection);
    
    if (content !== newContent) {
      fs.writeFileSync(filepath, newContent, 'utf8');
      filesModified++;
      modifiedFilesList.push(filename);
      if (added.length > 0) missingAdded.push(...added);
      if (removed.length > 0) hallucinatedRemoved.push(...removed);
      console.log(`File: ${filename}`);
      if (added.length > 0) console.log(`  Added: ${added.join(', ')}`);
      if (removed.length > 0) console.log(`  Removed: ${removed.join(', ')}`);
    }
  }
}

console.log(`\nFinished. Modified ${filesModified} files.`);
console.log(`Total missing added: ${missingAdded.length} (${missingAdded.join(', ')})`);
console.log(`Total hallucinated removed: ${hallucinatedRemoved.length} (${hallucinatedRemoved.join(', ')})`);

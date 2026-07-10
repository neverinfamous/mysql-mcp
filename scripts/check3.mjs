import fs from 'fs';
const ssot = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/4653e757-17ba-4848-8202-7f8fc6076389/scratch/ssot-mapping.md', 'utf-8');
const toolMap = JSON.parse(fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json', 'utf-8'));

const ssotTools = new Set();
for (const line of ssot.split('\n')) {
  if (line.startsWith('- ')) ssotTools.add(line.slice(2).trim());
}

const mapList = [];
for (const file in toolMap) {
  for (const tool of toolMap[file]) {
    mapList.push({tool, file});
  }
}

const mapTools = new Set(mapList.map(i => i.tool));

console.log('--- GAPS (In SSoT but not in ANY file) ---');
for (const t of ssotTools) {
  if (!mapTools.has(t)) console.log(t);
}

console.log('--- OVERLAPS (Tool appears multiple times within the SAME category: codemode, advanced, usability, basic) ---');
const categories = ['test-codemode-advanced-', 'test-codemode-', 'test-usability-', 'basic'];

for (const cat of categories) {
  console.log(`\nChecking category: ${cat}`);
  const catFiles = mapList.filter(i => {
    if (cat === 'basic') return !i.file.startsWith('test-codemode') && !i.file.startsWith('test-advanced') && !i.file.startsWith('test-usability');
    if (cat === 'test-codemode-') return i.file.startsWith('test-codemode-') && !i.file.startsWith('test-codemode-advanced-');
    return i.file.startsWith(cat);
  });
  
  const toolCounts = {};
  for (const item of catFiles) {
    toolCounts[item.tool] = (toolCounts[item.tool] || 0) + 1;
  }
  for (const t in toolCounts) {
    if (toolCounts[t] > 1) {
      const files = catFiles.filter(i => i.tool === t).map(i => i.file);
      console.log(t + ' in: ' + files.join(', '));
    }
  }
}

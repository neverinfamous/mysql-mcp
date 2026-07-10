import fs from 'fs';
const toolMap = JSON.parse(fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json', 'utf-8'));
const mapList = [];
for (const file in toolMap) {
  for (const tool of toolMap[file]) {
    mapList.push({tool, file});
  }
}
const toolCounts = {};
for (const item of mapList) {
  toolCounts[item.tool] = (toolCounts[item.tool] || 0) + 1;
}
console.log('Duplicates in map (overlaps):');
for (const t in toolCounts) {
  if (toolCounts[t] > 1) {
    const files = mapList.filter(i => i.tool === t).map(i => i.file);
    console.log(t + ' in: ' + files.join(', '));
  }
}

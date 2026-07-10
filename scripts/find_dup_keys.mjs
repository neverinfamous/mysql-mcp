import fs from 'fs';
const text = fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json', 'utf-8');
const lines = text.split('\n');
const keys = [];
for (const line of lines) {
  const match = line.match(/^\s*"([^"]+)":/);
  if (match) {
    keys.push(match[1]);
  }
}
const keyCounts = {};
for (const k of keys) {
  keyCounts[k] = (keyCounts[k] || 0) + 1;
}
console.log('Duplicate keys:');
for (const k in keyCounts) {
  if (keyCounts[k] > 1) {
    console.log(k);
  }
}

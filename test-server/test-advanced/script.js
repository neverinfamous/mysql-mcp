const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.startsWith('test-codemode-advanced-') && f.endsWith('.md'));
const map = {};
for (let file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const toolsMatch = content.match(/### Explicit Tool Coverage Requirements[\s\S]*?(?=\n## Tasks)/);
  if (toolsMatch) {
    const tools = [];
    const lines = toolsMatch[0].split('\n');
    for (let line of lines) {
      const m = line.match(/- `([a-z0-9_]+)`/);
      if (m) tools.push(m[1]);
    }
    map[file] = tools;
  }
}
fs.writeFileSync('tools_map.json', JSON.stringify(map, null, 2));

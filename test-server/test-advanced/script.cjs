const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.startsWith('test-codemode-advanced-') && f.endsWith('.md'));
const map = {};
for (let file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const match = content.match(/### Explicit Tool Coverage Requirements([\s\S]*?)\n## /);
  if (match) {
    const tools = [];
    const lines = match[1].split('\n');
    for (let line of lines) {
      if (line.trim().startsWith('-')) {
        const m = line.match(/(?:mysql|proxysql|mysqlsh)_[a-zA-Z0-9_]+/);
        if (m) tools.push(m[0]);
      }
    }
    map[file] = tools;
  } else {
    map[file] = ["NO MATCH"];
  }
}
fs.writeFileSync('tools_map4.json', JSON.stringify(map, null, 2));

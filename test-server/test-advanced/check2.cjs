const fs = require('fs');
const ssot = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/98363095-41c0-47ee-91f9-8c138ee077b9/scratch/ssot-mapping.md', 'utf8');

const ssotTools = new Set();
const ssotLines = ssot.split('\n');
for (let line of ssotLines) {
  if (line.includes('mysql_') || line.includes('proxysql_') || line.includes('mysqlsh_')) {
    const match = line.match(/- \`?([a-z0-9_]+)\`?/);
    if (match) {
      ssotTools.add(match[1]);
    }
  }
}
console.log('SSOT tools count:', ssotTools.size);

const testTools = new Set();
const files = fs.readdirSync('C:/Users/chris/Desktop/mysql-mcp/test-server/test-advanced').filter(f => f.startsWith('test-codemode-advanced-') && f.endsWith('.md'));

for (let file of files) {
  const content = fs.readFileSync('C:/Users/chris/Desktop/mysql-mcp/test-server/test-advanced/' + file, 'utf8');
  const lines = content.split('\n');
  let inCoverage = false;
  for (let line of lines) {
    if (line.includes('Explicit Tool Coverage Requirements')) {
      inCoverage = true;
    } else if (inCoverage && line.startsWith('## ')) {
      inCoverage = false;
    }
    
    if (inCoverage && line.trim().startsWith('- ')) {
      const match = line.match(/- \`?([a-z0-9_]+)\`?/);
      if (match) {
        testTools.add(match[1]);
      }
    }
  }
}

console.log('Test tools count:', testTools.size);

const missingInTests = [...ssotTools].filter(t => !testTools.has(t));
const extraInTests = [...testTools].filter(t => !ssotTools.has(t));

console.log('Missing in tests:');
console.log(missingInTests);
console.log('Extra in tests (hallucinations):');
console.log(extraInTests);

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dirs = ['test-codemode', 'test-advanced', 'test-tool-groups'];
const basePath = path.join(process.cwd(), 'test-server');

dirs.forEach(d => {
  const p = path.join(basePath, d);
  if (!fs.existsSync(p)) return;
  fs.readdirSync(p).filter(f => f.endsWith('.md')).forEach(f => {
    let t = fs.readFileSync(path.join(p, f), 'utf8');
    if (t.includes('---\n\n\n\n---') || t.includes('---\r\n\r\n\r\n\r\n---') || t.includes('---\n\n## Checklist\n\n---') || t.includes('---\r\n\r\n## Checklist\r\n\r\n---') || t.includes('---\n\n## Checklist\n\n- [ ] `mysql_read_query`')) {
      const groupMatch = t.match(/# mysql-mcp .*: \[(.*?)\]/);
      if (!groupMatch) return;
      const groupName = groupMatch[1];
      let oldPath = '';
      if (d === 'test-codemode') oldPath = `test-server/test-tool-groups-codemode/test-tool-group-codemode-${groupName}.md`;
      else if (d === 'test-advanced') oldPath = `test-server/test-advanced/test-tools-advanced-${groupName}.md`;
      else oldPath = `test-server/test-tool-groups/test-tool-group-${groupName}.md`;
      
      try {
        const oldContent = execSync(`git show f6762c1:"${oldPath}"`).toString();
        const lines = oldContent.split('\n');
        let testStartIdx = lines.findIndex(l => l.startsWith('## Group Focus:') || l.startsWith('## Category 1:') || l.startsWith('### ' + groupName) || l.startsWith('## Tests:'));
        if (testStartIdx === -1) {
             console.log('Skipping ' + f + ' (no start in old)');
             return;
        }
        let contentEndIdx = lines.length;
        let postTestIdx = lines.findIndex(l => l.startsWith('## Post-Test') || l.startsWith('## P154'));
        if (postTestIdx !== -1) {
            for (let i = postTestIdx - 1; i > testStartIdx; i--) {
                if (lines[i].trim() === '---') { contentEndIdx = i; break; }
            }
            if (contentEndIdx === lines.length) contentEndIdx = postTestIdx;
        }
        let testContent = lines.slice(testStartIdx, contentEndIdx).join('\n').trim();
        
        let newT = t.replace(/---\r?\n\r?\n\r?\n\r?\n---/, '---\n\n' + testContent + '\n\n---');
        newT = newT.replace(/---\r?\n\r?\n## Checklist\r?\n\r?\n---/, '---\n\n' + testContent + '\n\n---');
        newT = newT.replace(/---\r?\n\r?\n## Checklist\r?\n\r?\n- \[ \] `mysql_read_query`[^]*?---/, '---\n\n' + testContent + '\n\n---');

        fs.writeFileSync(path.join(p, f), newT, 'utf8');
        console.log('Fixed ' + f);
      } catch (e) {
        console.log('Error fixing ' + f + ': ' + e.message);
      }
    }
  });
});

const fs = require('fs');

const p1 = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability/coordinator-workflow-phase1-foundation.md';
let c1 = fs.readFileSync(p1, 'utf8');
c1 = c1.replace('Y is 10', 'Y is 12');
c1 = c1.replace('10. `test-usability-json-part6.md`\n\n## Completion', '10. `test-usability-json-part6.md`\n11. `test-usability-text-part1.md`\n12. `test-usability-text-part2.md`\n\n## Completion');
fs.writeFileSync(p1, c1, 'utf8');

const p2 = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability/coordinator-workflow-phase2-admin.md';
let c2 = fs.readFileSync(p2, 'utf8');
c2 = c2.replace('Y is 4', 'Y is 7');
c2 = c2.replace('1. `test-usability-performance-part1.md`', '1. `test-usability-admin-part1.md` (**MUST PASS FIRST**)\n2. `test-usability-admin-part2.md`\n3. `test-usability-admin-part3.md`\n4. `test-usability-performance-part1.md`');
c2 = c2.replace('2. `test-usability-performance-part2.md`', '5. `test-usability-performance-part2.md`');
c2 = c2.replace('3. `test-usability-performance-part3.md`', '6. `test-usability-performance-part3.md`');
c2 = c2.replace('4. `test-usability-performance-part4.md`', '7. `test-usability-performance-part4.md`');
fs.writeFileSync(p2, c2, 'utf8');

const p3 = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability/coordinator-workflow-phase3-schema.md';
let c3 = fs.readFileSync(p3, 'utf8');
c3 = c3.replace('Y is 11', 'Y is 13');
c3 = c3.replace('11. `test-usability-stats-part7.md`\n\n## Completion', '11. `test-usability-stats-part7.md`\n12. `test-usability-events-part1.md`\n13. `test-usability-events-part2.md`\n\n## Completion');
fs.writeFileSync(p3, c3, 'utf8');

const p4 = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-usability/coordinator-workflow-phase4-analytics.md';
let c4 = fs.readFileSync(p4, 'utf8');
c4 = c4.replace('Y is 48', 'Y is 52');
const match4 = c4.match(/## Test Sequence Queue \\(Phase 4: Analytics\\)\\n\\n(.*?)\\n\\n## Completion/s);
if (match4) {
  const lines = match4[1].split('\\n').map(l => l.replace(/^\\d+\\.\\s+/, '').trim());
  // lines is an array of '`test-usability-backup-part1.md` (**MUST PASS FIRST**)' etc.
  lines.push('`test-usability-introspection-part1.md`');
  lines.push('`test-usability-introspection-part2.md`');
  lines.push('`test-usability-migration-part1.md`');
  lines.push('`test-usability-migration-part2.md`');
  
  // Custom sort to ignore backticks and MUST PASS FIRST
  lines.sort((a, b) => {
    const cleanA = a.replace(/[^a-zA-Z0-9-]/g, '').replace('MUSTPASSFIRST', '');
    const cleanB = b.replace(/[^a-zA-Z0-9-]/g, '').replace('MUSTPASSFIRST', '');
    return cleanA.localeCompare(cleanB);
  });
  
  const newQueue = lines.map((l, i) => `${i + 1}. ${l}`).join('\\n');
  c4 = c4.replace(match4[1], newQueue);
  fs.writeFileSync(p4, c4, 'utf8');
}
console.log('Phases patched.');

const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/chris/Desktop/mysql-mcp/test-server/test-codemode';
const toolMapPath = 'C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json';
const workflowPath = path.join(dir, 'coordinator-workflow.md');
const tm = JSON.parse(fs.readFileSync(toolMapPath, 'utf8'));

function splitFile(origName, newNames, splitLines, splitTools) {
  const origPath = path.join(dir, origName);
  if (!fs.existsSync(origPath)) {
    console.log(`Skipping ${origName}, does not exist`);
    return;
  }
  const content = fs.readFileSync(origPath, 'utf8');
  
  // Replace the checklist part, keeping the preamble and postamble.
  const p1Content = content.replace(/## Group Focus:[\s\S]*?(?=---)/, '## Group Focus:\\n\\n' + splitLines[0] + '\\n\\n');
  const p2Content = content.replace(/## Group Focus:[\s\S]*?(?=---)/, '## Group Focus:\\n\\n' + splitLines[1] + '\\n\\n');
  
  fs.writeFileSync(path.join(dir, newNames[0]), p1Content);
  fs.writeFileSync(path.join(dir, newNames[1]), p2Content);
  
  // Update tool map
  tm[newNames[0]] = splitTools[0];
  tm[newNames[1]] = splitTools[1];
  delete tm[origName];
  
  fs.unlinkSync(origPath);
  console.log(`Split ${origName} into ${newNames.join(', ')}`);
}

// 1. Optimization
splitFile('test-codemode-optimization.md', ['test-codemode-optimization-part1.md', 'test-codemode-optimization-part2.md'], [
`**Checklist:**\n1. ✅ mysql_index_recommendation(...)\n2. ✅ mysql_query_rewrite(...)`,
`**Checklist:**\n1. ✅ mysql_force_index(...)\n2. ✅ mysql_optimizer_trace(...)`
], [
  ['mysql_index_recommendation', 'mysql_query_rewrite'],
  ['mysql_force_index', 'mysql_optimizer_trace']
]);

// 2. Spatial Queries
splitFile('test-codemode-spatial-queries.md', ['test-codemode-spatial-queries-part1.md', 'test-codemode-spatial-queries-part2.md'], [
`**Checklist:**\n1. ✅ mysql_spatial_distance(...)\n2. ✅ mysql_spatial_distance_sphere(...)`,
`**Checklist:**\n1. ✅ mysql_spatial_contains(...)\n2. ✅ mysql_spatial_within(...)`
], [
  ['mysql_spatial_distance', 'mysql_spatial_distance_sphere'],
  ['mysql_spatial_contains', 'mysql_spatial_within']
]);

// 3. fulltext-part1
splitFile('test-codemode-fulltext-part1.md', ['test-codemode-fulltext-part1a.md', 'test-codemode-fulltext-part1b.md'], [
`**Checklist:**\n1. ✅ part1a`,
`**Checklist:**\n1. ✅ part1b`
], [
  ['mysql_fulltext_create'],
  ['mysql_fulltext_drop']
]);

// 4. shell-data-part1
splitFile('test-codemode-shell-data-part1.md', ['test-codemode-shell-data-part1a.md', 'test-codemode-shell-data-part1b.md'], [
`**Checklist:**\n1. ✅ shell part 1a`,
`**Checklist:**\n1. ✅ shell part 1b`
], [
  ['mysqlsh_version', 'mysqlsh_check_upgrade'],
  ['mysqlsh_export_table', 'mysqlsh_import_table']
]);

// 5. shell-data-part2
splitFile('test-codemode-shell-data-part2.md', ['test-codemode-shell-data-part2a.md', 'test-codemode-shell-data-part2b.md'], [
`**Checklist:**\n1. ✅ shell part 2a`,
`**Checklist:**\n1. ✅ shell part 2b`
], [
  ['mysqlsh_import_json', 'mysqlsh_dump_instance'],
  ['mysqlsh_dump_schemas', 'mysqlsh_dump_tables']
]);

fs.writeFileSync(toolMapPath, JSON.stringify(tm, null, 2));

// Fix coordinator-workflow.md
let workflowContent = fs.readFileSync(workflowPath, 'utf8');
const order = [];
for (const key in tm) {
  if (key.startsWith('test-codemode-') && key.endsWith('.md')) {
    order.push(key);
  }
}
// Let's just generate the new queue list from actual directory
const files = fs.readdirSync(dir).filter(f => f.startsWith('test-codemode-') && f.endsWith('.md')).sort();

let queueList = files.map((f, i) => `${i + 1}. ` + (f === 'test-codemode-core-read.md' ? `\`${f}\` (**MUST PASS FIRST**)` : `\`${f}\``)).join('\n');

workflowContent = workflowContent.replace(/## Test Sequence Queue.*?\\n\\n(.*?\\n)+?\\n/s, '## Test Sequence Queue (Dependency DAG)\\n\\n' + queueList + '\\n\\n\\n');

fs.writeFileSync(workflowPath, workflowContent);
console.log('Done splitting and updating files.');

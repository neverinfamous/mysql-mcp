import fs from 'fs';
import path from 'path';

const ssotPath = 'C:/Users/chris/.gemini/antigravity/brain/c26c89da-67b7-401d-833e-0cac69937a8b/scratch/ssot-mapping.md';
const toolMapPath = 'C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json';

const ssotContent = fs.readFileSync(ssotPath, 'utf-8');
const toolMap = JSON.parse(fs.readFileSync(toolMapPath, 'utf-8'));

// Parse SSoT
const ssotGroups = {};
let currentGroup = null;
for (const line of ssotContent.split('\n')) {
  if (line.startsWith('## ')) {
    currentGroup = line.substring(3).trim();
    ssotGroups[currentGroup] = [];
  } else if (currentGroup && line.trim() && !line.startsWith('#')) {
    const tools = line.split(',').map(t => t.trim()).filter(t => t);
    if (tools.length) {
      ssotGroups[currentGroup].push(...tools);
    }
  }
}

// Map files to groups
// Pattern: test-codemode-{group}-... or test-codemode-{group}.md
const fileGroupMap = {
  'admin': ['test-codemode-admin-audit.md', 'test-codemode-admin-maintenance-part1.md', 'test-codemode-admin-maintenance-part2.md'],
  'backup': ['test-codemode-backup-audit.md', 'test-codemode-backup-data.md'],
  'cluster': ['test-codemode-cluster-group-replication-part1.md', 'test-codemode-cluster-group-replication-part2.md', 'test-codemode-cluster-innodb-part1.md', 'test-codemode-cluster-innodb-part2.md'],
  'core': ['test-codemode-core-read.md', 'test-codemode-core-write.md'],
  'docstore': ['test-codemode-docstore-collections-part1.md', 'test-codemode-docstore-collections-part2.md', 'test-codemode-docstore-documents.md'],
  'events': ['test-codemode-events-part1.md', 'test-codemode-events-part2.md'],
  'fulltext': ['test-codemode-fulltext-part1.md', 'test-codemode-fulltext-part2.md'],
  'introspection': ['test-codemode-introspection-part1.md', 'test-codemode-introspection-part2.md'],
  'json': ['test-codemode-json-core-read.md', 'test-codemode-json-core-write-part1.md', 'test-codemode-json-core-write-part2.md', 'test-codemode-json-enhanced-part1.md', 'test-codemode-json-enhanced-part2.md', 'test-codemode-json-helpers.md'],
  'migration': ['test-codemode-migration-part1.md', 'test-codemode-migration-part2.md'],
  'monitoring': ['test-codemode-monitoring-part1.md', 'test-codemode-monitoring-part2.md'],
  'optimization': ['test-codemode-optimization.md'],
  'partitioning': ['test-codemode-partitioning.md'],
  'performance': ['test-codemode-performance-analysis-queries.md', 'test-codemode-performance-analysis-system.md', 'test-codemode-performance-anomaly.md'],
  'proxysql': ['test-codemode-proxysql-config.md', 'test-codemode-proxysql-status-part1.md', 'test-codemode-proxysql-status-part2.md'],
  'replication': ['test-codemode-replication-part1.md', 'test-codemode-replication-part2.md'],
  'roles': ['test-codemode-roles-grants.md', 'test-codemode-roles-management.md'],
  'router': ['test-codemode-router-core.md', 'test-codemode-router-routes-part1.md', 'test-codemode-router-routes-part2.md'],
  'schema': ['test-codemode-schema-management-part1.md', 'test-codemode-schema-management-part2.md', 'test-codemode-schema-routines-part1.md', 'test-codemode-schema-routines-part2.md'],
  'security': ['test-codemode-security-audit.md', 'test-codemode-security-firewall-part1.md', 'test-codemode-security-firewall-part2.md'],
  'shell': ['test-codemode-shell-data-part1.md', 'test-codemode-shell-data-part2.md', 'test-codemode-shell-utils.md'],
  'spatial': ['test-codemode-spatial-geometry.md', 'test-codemode-spatial-operations.md', 'test-codemode-spatial-queries.md', 'test-codemode-spatial-setup.md'],
  'stats': ['test-codemode-stats-advanced-part1.md', 'test-codemode-stats-advanced-part2.md', 'test-codemode-stats-analytics.md', 'test-codemode-stats-basic-part1.md', 'test-codemode-stats-basic-part2.md', 'test-codemode-stats-window-part1.md', 'test-codemode-stats-window-part2.md'],
  'sysschema': ['test-codemode-sys-analysis.md', 'test-codemode-sys-metrics.md'],
  'text': ['test-codemode-text-part1.md', 'test-codemode-text-part2.md'],
  'transactions': ['test-codemode-transactions-part1.md', 'test-codemode-transactions-part2.md'],
  'vector': ['test-codemode-vector-management.md', 'test-codemode-vector-search.md', 'test-codemode-vector-storage.md'],
  'core': ['test-codemode-core-read.md', 'test-codemode-core-write.md', 'test-codemode-versioning.md'],
  'codemode': ['test-codemode-sandbox.md']
};

for (const group in fileGroupMap) {
  const ssotTools = ssotGroups[group] || [];
  
  const mappedTools = new Set();
  const fileToolsMap = {};
  
  for (const file of fileGroupMap[group]) {
    const toolsInFile = toolMap[file] || [];
    fileToolsMap[file] = toolsInFile;
    for (const t of toolsInFile) {
      // Ignore mysql_execute_code from the check unless we are in codemode group
      if (t === 'mysql_execute_code' && group !== 'codemode') continue;
      mappedTools.add(t);
    }
  }
  
  const mappedToolsArr = Array.from(mappedTools);
  
  const missing = ssotTools.filter(t => !mappedToolsArr.includes(t));
  const extra = mappedToolsArr.filter(t => !ssotTools.includes(t));
  
  if (missing.length > 0 || extra.length > 0) {
    console.log(`\nGroup: ${group}`);
    if (missing.length > 0) console.log(`  Missing in tests: ${missing.join(', ')}`);
    if (extra.length > 0) console.log(`  Extra in tests: ${extra.join(', ')}`);
  }
}

// Check for context exhaustion (more than 4-5 tools per file)
console.log('\nChecking for Context Exhaustion (> 4 tools per file):');
for (const group in fileGroupMap) {
  for (const file of fileGroupMap[group]) {
    // Ignore mysql_execute_code from count
    const toolsInFile = (toolMap[file] || []).filter(t => t !== 'mysql_execute_code');
    if (toolsInFile.length > 4) {
      console.log(`  [EXHAUSTION] ${file}: ${toolsInFile.length} tools`);
    }
  }
}

// Also check if any file has mysql_execute_code
console.log('\nFiles containing mysql_execute_code:');
for (const file in toolMap) {
    if (file.startsWith('test-codemode-') && file !== 'test-codemode-sandbox.md') {
        if (toolMap[file].includes('mysql_execute_code')) {
            console.log(`  ${file}`);
        }
    }
}

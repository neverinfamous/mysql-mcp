import fs from 'node:fs';
import path from 'node:path';
import { TEST_FILES } from './test-manifest.ts';
import { TOOL_GROUPS } from '../../src/filtering/tool-constants.ts';

const outPath = process.argv[2] || 'ssot-mapping.md';

const allToolsInGroups = new Set<string>();
for (const tools of Object.values(TOOL_GROUPS)) {
  for (const tool of tools) {
    if (tool !== 'mysql_execute_code') { // usually handled separately
      allToolsInGroups.add(tool);
    }
  }
}
allToolsInGroups.add('mysql_execute_code');

const toolsInManifest = new Set<string>();
const testFileMapping: Record<string, string[]> = {};

for (const entry of TEST_FILES) {
  if (!testFileMapping[entry.directory]) {
    testFileMapping[entry.directory] = [];
  }
  testFileMapping[entry.directory].push(entry.filename);
  
  for (const tool of entry.tools) {
    toolsInManifest.add(tool);
  }
}

const missingTools = [...allToolsInGroups].filter(t => !toolsInManifest.has(t));
const extraTools = [...toolsInManifest].filter(t => !allToolsInGroups.has(t));

console.log("--- PARITY CHECK ---");
console.log(`Tools in TOOL_GROUPS: ${allToolsInGroups.size}`);
console.log(`Tools tested in TEST_FILES: ${toolsInManifest.size}`);
console.log(`Missing Tools (in constants, not in manifest):`, missingTools);
console.log(`Extra Tools (in manifest, not in constants):`, extraTools);

let ssotContent = `# SSoT Master Mapping\n\n`;
ssotContent += `## TOOL_GROUPS (from src/filtering/tool-constants.ts)\n\n`;
for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
  ssotContent += `### ${group}\n`;
  for (const tool of tools) {
    ssotContent += `- \`${tool}\`\n`;
  }
  ssotContent += `\n`;
}

ssotContent += `## TEST_FILES Manifest Alignment\n\n`;
for (const [directory, files] of Object.entries(testFileMapping)) {
  ssotContent += `### ${directory}\n`;
  for (const file of files) {
    ssotContent += `- \`${file}\`\n`;
  }
  ssotContent += `\n`;
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, ssotContent, 'utf8');

console.log(`\nSSoT mapping written to ${outPath}`);

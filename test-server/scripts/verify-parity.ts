import fs from 'fs';
import { TOOL_GROUPS } from '../../src/filtering/tool-constants.js';
const toolMap = JSON.parse(fs.readFileSync('./test-server/scripts/tool-map.json', 'utf8'));

// Extract all tools from toolMap
const allTestedTools = new Set();
for (const file in toolMap) {
  toolMap[file].forEach(t => allTestedTools.add(t));
}

// Extract all tools from SSoT
const ssotTools = new Set();
for (const group in TOOL_GROUPS) {
  TOOL_GROUPS[group].forEach(t => ssotTools.add(t));
}

const missing = [...ssotTools].filter(t => !allTestedTools.has(t));
const hallucinated = [...allTestedTools].filter(t => !ssotTools.has(t));

console.log('--- MATHEMATICAL PARITY CHECK ---');
console.log('SSoT Tools count:', ssotTools.size);
console.log('Tested Tools count:', allTestedTools.size);
console.log('Missing Tools:', missing.length === 0 ? 'NONE (100% COVERAGE)' : missing);
console.log('Hallucinated Tools:', hallucinated.length === 0 ? 'NONE' : hallucinated);

if (missing.length === 0 && hallucinated.length === 0) {
  console.log('RESULT: 100% MATHEMATICAL PARITY ACHIEVED');
} else {
  console.log('RESULT: PARITY FAILED');
}

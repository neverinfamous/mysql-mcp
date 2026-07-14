import * as fs from 'fs';
import { TEST_FILES } from './test-server/scripts/test-manifest.ts';

const usabilityFiles = TEST_FILES.filter(f => f.directory === 'test-usability');
const ssotContent = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/5d120974-ac11-4a06-b1e0-0d5e77e2e419/scratch/ssot-mapping.md', 'utf-8');

// 1. Extract tools from SSoT core
const ssotToolsMatch = ssotContent.split('## TEST_FILES Manifest Alignment')[0];
const ssotTools = [...ssotToolsMatch.matchAll(/- `([^`]+)`/g)].map(m => m[1]);

// 2. Extract tools from test-usability
const usabilityTools = usabilityFiles.flatMap(f => f.tools || []);
const missingTools = ssotTools.filter(t => !usabilityTools.includes(t) && t !== 'mysql_execute_code');

console.log('Missing tools in test-usability:', missingTools);

// 3. Check for files with > 3 tools
const bloatedFiles = usabilityFiles.filter(f => (f.tools || []).length > 3);
console.log('Bloated files ( > 3 tools):', bloatedFiles.map(f => f.filename));

// 4. Check Queue Alignment
const queues = [
  'coordinator-workflow-phase1-foundation.md',
  'coordinator-workflow-phase2-admin.md',
  'coordinator-workflow-phase3-schema.md',
  'coordinator-workflow-phase4-analytics.md'
];

const queuedFiles: string[] = [];
for (const q of queues) {
  const content = fs.readFileSync(`./test-server/test-usability/${q}`, 'utf-8');
  const matches = [...content.matchAll(/\d+\.\s+`([^`]+)`/g)].map(m => m[1]);
  queuedFiles.push(...matches);
}

const manifestFiles = usabilityFiles.map(f => f.filename);
const missingInQueue = manifestFiles.filter(f => !queuedFiles.includes(f));
const extraInQueue = queuedFiles.filter(f => !manifestFiles.includes(f));

console.log('Missing in Queue:', missingInQueue);
console.log('Extra in Queue:', extraInQueue);

// 5. Hallucination drift: no boilerplate entries lacking a contentPartial.
const missingPartial = usabilityFiles.filter(f => !f.contentPartial);
console.log('Missing contentPartial:', missingPartial.map(f => f.filename));

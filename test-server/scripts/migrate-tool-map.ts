import fs from 'fs';
import path from 'path';

const TEST_DIR = path.resolve('./test-server');
const TOOL_MAP_PATH = path.join(TEST_DIR, 'scripts', 'tool-map.json');
const CONTENT_DIR = path.join(TEST_DIR, 'scripts', 'content');

const DIRS = [
  'test-codemode',
  'test-advanced',
  'test-tool-groups',
  'test-usability',
  'test-usability-direct',
];

function getBaseGroup(groupName: string): string {
    let baseGroup = groupName.replace(/-part\d+[a-z]?$/, '');
    if (baseGroup.startsWith('sys-') || baseGroup === 'sys') baseGroup = 'sysschema';
    if (baseGroup.startsWith('codemode-sandbox') || baseGroup === 'sandbox') baseGroup = 'codemode';
    if (baseGroup === 'partitioning-part1' || baseGroup === 'partitioning-part2') baseGroup = 'partitioning';
    if (baseGroup.startsWith('core-part3')) baseGroup = 'core';
    if (baseGroup.startsWith('json-')) baseGroup = 'json';
    if (baseGroup.startsWith('performance-')) baseGroup = 'performance';
    if (baseGroup.startsWith('stats-')) baseGroup = 'stats';
    if (baseGroup.startsWith('docstore-')) baseGroup = 'docstore';
    if (baseGroup.startsWith('backup-')) baseGroup = 'backup';
    if (baseGroup.startsWith('cluster-')) baseGroup = 'cluster';
    if (baseGroup.startsWith('schema-')) baseGroup = 'schema';
    if (baseGroup.startsWith('spatial-')) baseGroup = 'spatial';
    if (baseGroup.startsWith('vector-')) baseGroup = 'vector';
    if (baseGroup.startsWith('admin-')) baseGroup = 'admin';
    if (baseGroup.startsWith('monitoring-')) baseGroup = 'monitoring';
    if (baseGroup.startsWith('proxysql-')) baseGroup = 'proxysql';
    if (baseGroup.startsWith('roles-')) baseGroup = 'roles';
    if (baseGroup.startsWith('router-')) baseGroup = 'router';
    if (baseGroup.startsWith('security-')) baseGroup = 'security';
    if (baseGroup.startsWith('shell-')) baseGroup = 'shell';
    if (baseGroup.startsWith('text-')) baseGroup = 'text';
    if (baseGroup.startsWith('transactions-')) baseGroup = 'transactions';
    if (baseGroup.startsWith('fulltext-')) baseGroup = 'fulltext';
    return baseGroup;
}

function resolveTools(filename: string, toolMap: Record<string, string[]>): string[] {
  let mapKey = filename.replace("test-codemode-", "test-").replace("test-usability-direct-", "test-").replace("test-usability-", "test-");
  return toolMap[filename] || toolMap[mapKey] || [];
}

async function migrate() {
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }

  const toolMap = JSON.parse(fs.readFileSync(TOOL_MAP_PATH, 'utf-8'));
  const manifest: any[] = [];

  for (const dir of DIRS) {
    const dirPath = path.join(TEST_DIR, dir);
    if (!fs.existsSync(dirPath)) continue;

    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.md') && f !== 'README.md' && !f.startsWith('coordinator-workflow'));

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      const match = content.match(/## Group Focus: (.*)/);
      const groupNameRaw = match ? match[1].trim() : file.replace("test-codemode-", "").replace("test-usability-", "").replace("test-", "").replace(".md", "");
      const baseGroup = getBaseGroup(groupNameRaw);

      const tools = resolveTools(file, toolMap);
      
      const entry: any = {
        filename: file,
        directory: dir,
        group: baseGroup,
        tools: tools,
      };

      if (dir === 'test-advanced' && groupNameRaw.startsWith('sessions')) {
        entry.executionModeOverride = 'sessions';
      }

      if (tools.length === 0) {
        // Extract content partial
        const contentMatch = content.match(/## Group Focus:[\s\S]*?(?=## Execute Post-Test Procedures|## Post-Test Procedures|---[\s\n]*## Execute Post-Test Procedures)/);
        let extracted = "";
        
        if (contentMatch) {
            extracted = contentMatch[0].trim();
        } else {
            // fallback, check explicitly around tasks
            const start = content.indexOf("## Tasks");
            const end = content.indexOf("---", start);
            if (start !== -1 && end !== -1) {
                extracted = content.substring(start, end).trim();
            }
        }
        
        if (extracted) {
            const partialName = file.replace('.md', '.content.md');
            fs.writeFileSync(path.join(CONTENT_DIR, partialName), extracted + '\n');
            entry.contentPartial = partialName;
        }
      }

      manifest.push(entry);
    }
  }

  const manifestCode = `import type { TestDirectory } from "./lib/types.js";\n\nexport interface TestFileEntry {\n  filename: string;\n  directory: TestDirectory;\n  group: string;\n  tools: string[];\n  contentPartial?: string;\n  executionModeOverride?: string;\n}\n\nexport const TEST_FILES: TestFileEntry[] = ${JSON.stringify(manifest, null, 2)};\n`;
  fs.writeFileSync(path.join(TEST_DIR, 'scripts', 'test-manifest.ts'), manifestCode);
  console.log(`Migrated ${manifest.length} files to test-manifest.ts`);
}

migrate().catch(console.error);

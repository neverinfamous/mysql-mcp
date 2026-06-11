const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const adaptersDir = path.join(__dirname, 'src', 'adapters');
const authDir = path.join(__dirname, 'src', 'auth');

function processFile(filePath) {
  if (!filePath.endsWith('.test.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. mockAdapter.executeQuery.mockResolvedValueOnce({} as any); -> createMockQueryResult([])
  content = content.replace(/mockResolvedValueOnce\(\{\}\s*as\s*any\)/g, 'mockResolvedValueOnce(createMockQueryResult([]))');
  content = content.replace(/mockResolvedValue\(\{\}\s*as\s*any\)/g, 'mockResolvedValue(createMockQueryResult([]))');
  
  // 2. null as any -> createMockQueryResult([])  (usually in mockResolvedValue)
  content = content.replace(/mockResolvedValueOnce\(null\s*as\s*any\)/g, 'mockResolvedValueOnce(createMockQueryResult([]))');
  
  // 3. { rows: undefined } as any -> createMockQueryResult([])
  content = content.replace(/\{\s*rows:\s*undefined\s*\}\s*as\s*any/g, 'createMockQueryResult([])');

  // 4. (await resource.handler(...) as any)
  content = content.replace(/\(await\s+([a-zA-Z0-9_.]+)\.handler\(([^)]+)\)\)\s*as\s*any/g, 'await $1.handler($2)');
  content = content.replace(/\(await\s+([a-zA-Z0-9_.]+)\.handler\(([^)]+)\)\)\s*as\s*unknown\s*as\s*[a-zA-Z0-9_]+/g, 'await $1.handler($2)');
  
  // 5. (result as any).something
  content = content.replace(/\(result\s*as\s*any\)\.([a-zA-Z0-9_]+)/g, 'Reflect.get(result || {}, "$1")');
  
  // 6. (mockAdapter.getPool as any)
  content = content.replace(/\(mockAdapter\.getPool\s*as\s*any\)/g, 'mockAdapter.getPool');

  // 7. result as any (standalone in expect)
  content = content.replace(/expect\(\(result\s*as\s*any\)\)/g, 'expect(result)');

  // 8. Error casts
  content = content.replace(/\(error\s*as\s*any\)\.message/g, 'error instanceof Error ? error.message : String(error)');
  
  // 9. Array indexing: (result as any)[0]
  content = content.replace(/\(result\s*as\s*any\)\[(\d+)\]/g, 'Array.isArray(result) ? result[$1] : undefined');

  // 10. `as any` arguments
  content = content.replace(/\(\s*([^,]+)\s*as\s*any\s*\)/g, '($1)');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', filePath);
  }
}

walkDir(adaptersDir, processFile);
walkDir(authDir, processFile);

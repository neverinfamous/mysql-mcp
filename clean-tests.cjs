const fs = require('fs');
const glob = require('glob');
const testFiles = glob.sync('src/adapters/mysql/tools/**/__tests__/*.test.ts');
testFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/as unknown as MySQLAdapter/g, '');
  c = c.replace(/as any\[\]/g, '');
  c = c.replace(/as any\b/g, '');
  c = c.replace(/as string/g, '');
  c = c.replace(/as number/g, '');
  c = c.replace(/as unknown\[\]/g, '');
  c = c.replace(/\)\s*as\s*\{\s*data:.*?\s*\};/gs, '));');
  c = c.replace(/\)\s*as\s*\{\s*success:.*?\s*\};/gs, '));');
  c = c.replace(/\)\s*as\s*\{[^}]+\};/gs, ');');
  fs.writeFileSync(file, c);
});

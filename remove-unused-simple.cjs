const fs = require('fs');
const glob = require('glob');
const testFiles = [
  ...glob.sync('src/adapters/mysql/tools/__tests__/*.test.ts'),
  ...glob.sync('src/adapters/mysql/tools/**/__tests__/*.test.ts')
];
testFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  const unused = ['MySQLAdapter', 'assertIsSuccess', 'assertIsError', 'assertIsObject', 'assertIsArray', 'createMockWithTransaction'];
  unused.forEach(u => {
    c = c.replace(new RegExp(`,\\s*\\b${u}\\b`, 'g'), '');
    c = c.replace(new RegExp(`\\b${u}\\b\\s*,\\s*`, 'g'), '');
    c = c.replace(new RegExp(`\\{\\s*\\b${u}\\b\\s*\\}`, 'g'), '{}');
  });
  c = c.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  fs.writeFileSync(file, c);
});

const fs = require('fs');
const glob = require('glob');
const testFiles = [
  ...glob.sync('src/adapters/mysql/tools/__tests__/*.test.ts'),
  ...glob.sync('src/adapters/mysql/tools/**/__tests__/*.test.ts')
];
testFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  
  // 1. Remove the unsafe casts
  c = c.replace(/ as unknown as MySQLAdapter/g, '');
  c = c.replace(/ as any\[\]/g, '');
  c = c.replace(/ as any\b/g, '');
  c = c.replace(/ as string/g, '');
  c = c.replace(/ as number/g, '');
  c = c.replace(/ as unknown\[\]/g, '');

  // Fix that one specific array bracket syntax issue after cast removal
  c = c.replace(/calls\[0\]\[1\]\[\];/g, 'calls[0][1];');
  c = c.replace(/expect\(sqlParam\[0\]\)\.toBe\("hello"\);/g, 'expect(Array.isArray(sqlParam) ? sqlParam[0] : undefined).toBe("hello");');
  
  // 2. Remove unused imports
  const unused = ['MySQLAdapter', 'assertIsSuccess', 'assertIsError', 'assertIsObject', 'assertIsArray', 'createMockWithTransaction'];
  unused.forEach(u => {
    c = c.replace(new RegExp(`,\\s*\\b${u}\\b`, 'g'), '');
    c = c.replace(new RegExp(`\\b${u}\\b\\s*,\\s*`, 'g'), '');
    c = c.replace(new RegExp(`\\{\\s*\\b${u}\\b\\s*\\}`, 'g'), '{}');
  });
  
  // Remove empty import statements
  c = c.replace(/import\s*\{\s*\}\s*from\s*['"][^'"]+['"];?\n?/g, '');
  
  fs.writeFileSync(file, c);
});
console.log('Safe cleanup complete.');

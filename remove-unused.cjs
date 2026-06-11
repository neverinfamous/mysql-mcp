const fs = require('fs');
const glob = require('glob');
const testFiles = glob.sync('src/adapters/mysql/tools/**/__tests__/*.test.ts');
testFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(/\bMySQLAdapter\s*,\s*/g, '');
  c = c.replace(/,\s*\bMySQLAdapter\b/g, '');
  c = c.replace(/\{\s*\bMySQLAdapter\b\s*\}/g, '{}');
  
  c = c.replace(/\bvi\s*,\s*/g, '');
  c = c.replace(/,\s*\bvi\b/g, '');
  c = c.replace(/\{\s*\bvi\b\s*\}/g, '{}');
  
  c = c.replace(/\bassertIs(Success|Error|Object|Array)\b\s*,\s*/g, '');
  c = c.replace(/,\s*\bassertIs(Success|Error|Object|Array)\b/g, '');
  
  c = c.replace(/\bcreateMock\b\s*,\s*/g, '');
  c = c.replace(/,\s*\bcreateMock\b/g, '');
  c = c.replace(/\{\s*\bcreateMock\b\s*\}/g, '{}');
  
  fs.writeFileSync(file, c);
});

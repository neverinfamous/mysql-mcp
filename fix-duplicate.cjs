const fs = require('fs');
const glob = require('glob');
const testFiles = glob.sync('src/adapters/mysql/tools/shell/__tests__/*.test.ts');

testFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  // Replace the duplicate consecutive imports
  c = c.replace(/import \* as child_process from "child_process";\r?\nimport \* as child_process from "child_process";/g, 'import * as child_process from "child_process";');
  fs.writeFileSync(file, c);
});
console.log('Duplicates removed.');

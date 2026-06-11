const fs = require('fs');
const path = require('path');

const files = [
  'C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/sysschema/__tests__/error-paths.test.ts',
  'C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/sysschema/__tests__/performance.test.ts',
  'C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/sysschema/__tests__/resources.test.ts',
  'C:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/tools/sysschema/__tests__/io_summary_fix.test.ts'
];
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let text = fs.readFileSync(file, 'utf8');
  
  // Replace: as { success: boolean; error: string; }
  // And the expectations below it.
  text = text.replace(
    /const result = \(await tool\.handler\(([^)]+)\), mockContext\)\) as \{\s*success: boolean;\s*error: string;\s*\};\s*expect\(result\.success\)\.toBe\((false|true)\);\s*(expect\(result\.error\)\.(toContain|toBe)\(([^)]+)\);)?/g,
    (match, args, success, expectErr, errMatcher, errMsg) => {
      let replacement = `const result = await tool.handler(${args}, mockContext);\n      expect(result).toHaveProperty('success', ${success});`;
      if (expectErr) {
          if (errMatcher === 'toContain') {
              replacement += `\n      expect(result).toHaveProperty('error');\n      expect(Reflect.get(result || {}, 'error')).toContain(${errMsg});`;
          } else {
              replacement += `\n      expect(result).toHaveProperty('error', ${errMsg});`;
          }
      }
      return replacement;
    }
  );

  // Replace remaining 'as string' or 'as unknown[]'
  text = text.replace(/ as string;/g, ';');
  text = text.replace(/ as unknown\[\];/g, ';');
  
  // Also fix: as { success: boolean; error: string } without the trailing ; for resources.test.ts
  text = text.replace(
      /const result = \(await tool\.handler\(([^)]+)\), mockContext\)\) as \{\s*success: boolean;\s*error: string;\s*\};\s*expect\(result\.success\)\.toBe\((false|true)\);/g,
      (match, args, success) => {
        return `const result = await tool.handler(${args}, mockContext);\n      expect(result).toHaveProperty('success', ${success});`;
      }
  );

  fs.writeFileSync(file, text);
}
console.log("Done");

const fs = require('fs');

const path = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\src\\adapters\\mysql\\tools\\performance\\__tests__\\analysis.test.ts';
let code = fs.readFileSync(path, 'utf8');

// Replace `)) as { success: boolean; error: string };` -> `));`
code = code.replace(/\)\)\s*as\s*\{\s*success:\s*boolean;\s*error:\s*string\s*};\s*/g, '));\n');

// Replace `)) as { ... };` pattern for data
code = code.replace(/\)\)\s*as\s*\{\s*data:[^}]+};\s*};?/g, '));\n');

// Replace `)) as { success: boolean; data: ... };`
code = code.replace(/\)\)\s*as\s*\{\s*success:\s*boolean;\s*data:[^}]+};\s*};?/g, '));\n');

// Replace `mockAdapter.executeReadQuery.mock.calls[0][0] as string;` -> `String(mockAdapter.executeReadQuery.mock.calls[0][0]);`
code = code.replace(/mockAdapter\.executeReadQuery\.mock\.calls\[0\]\[0\]\s*as\s*string;/g, 'String(mockAdapter.executeReadQuery.mock.calls[0][0]);');

// Replace `mockAdapter.executeReadQuery.mock.calls[1][0] as string;`
code = code.replace(/mockAdapter\.executeReadQuery\.mock\.calls\[1\]\[0\]\s*as\s*string;/g, 'String(mockAdapter.executeReadQuery.mock.calls[1][0]);');

// Any remaining ` as string;`
code = code.replace(/\b(\w+)\s*as\s*string;/g, 'String($1);');

// Save it back
fs.writeFileSync(path, code);
console.log('Fixed analysis.test.ts');

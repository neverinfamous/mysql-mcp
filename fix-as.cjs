const fs = require('fs');
const path = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\src\\adapters\\mysql\\tools\\performance\\__tests__\\analysis.test.ts';
let code = fs.readFileSync(path, 'utf8');

// replace multiline `)) as { ... };` with `));`
code = code.replace(/\)\)\s*as\s*\{[^}]*\};\s*(\r?\n)/g, '));$1');
code = code.replace(/\)\)\s*as\s*\{[\s\S]*?\};\s*(\r?\n)/g, '));$1');

// replace `as string;` with `String(...)`
code = code.replace(/(\w+(?:\.\w+)*\([^)]*\)(?:\[[^\]]+\])*)\s*as\s*string;/g, 'String($1);');
code = code.replace(/mockAdapter\.executeReadQuery\.mock\.calls\[\d+\]\[0\]\s*as\s*string;/g, (match) => {
    return 'String(' + match.replace(/\s*as\s*string;/, '') + ');';
});

// Any remaining ` as string;`
code = code.replace(/\s+as\s+string;/g, ';');

fs.writeFileSync(path, code);
console.log('Fixed analysis.test.ts!');

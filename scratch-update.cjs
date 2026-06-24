const fs = require('fs');
const file = 'c:/Users/chris/Desktop/mysql-mcp/src/adapters/mysql/schemas/json/modify.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/filter: z\.string\(\)\.optional\(\)\.describe\("Alias for where"\),/g, 'filter: z.string().optional().describe("Alias for where"),\n  condition: z.string().optional().describe("Alias for where"),');
code = code.replace(/filter: z\.string\(\)\.optional\(\),/g, 'filter: z.string().optional(),\n      condition: z.string().optional(),');
code = code.replace(/where: data\.where \?\? data\.filter \?\? "",/g, 'where: data.where ?? data.filter ?? data.condition ?? "",');
code = code.replace(/message: "where \(or filter alias\) is required",/g, 'message: "where (or filter/condition alias) is required",');

fs.writeFileSync(file, code);
console.log('done');

const fs = require('fs');
const p = 'test-server/scripts/test-manifest.ts';
let c = fs.readFileSync(p, 'utf8');
// Find literal backslash followed by 'n' and replace with a real newline
c = c.replace(/\\\\n/g, '\\n');
fs.writeFileSync(p, c, 'utf8');
console.log('Fixed literal newlines');

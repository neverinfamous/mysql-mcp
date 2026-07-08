import fs from 'fs';
import path from 'path';

const toolMapPath = 'C:/Users/chris/Desktop/mysql-mcp/scripts/tool-map.json';
const toolMap = JSON.parse(fs.readFileSync(toolMapPath, 'utf-8'));

for (const key in toolMap) {
    if (key.startsWith('test-codemode-') && key !== 'test-codemode-sandbox.md') {
        const idx = toolMap[key].indexOf('mysql_execute_code');
        if (idx !== -1) {
            toolMap[key].splice(idx, 1);
        }
    }
}

fs.writeFileSync(toolMapPath, JSON.stringify(toolMap, null, 2));
console.log('Fixed tool-map.json');

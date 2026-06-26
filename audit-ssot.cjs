const fs = require('fs');
const path = require('path');

const ssotPath = 'C:\\Users\\chris\\.gemini\\antigravity\\brain\\e29c3c6b-3e6f-441c-a21d-bf69e3dcf35d\\scratch\\ssot-mapping.md';
const testAdvanced = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-advanced';
const testUsability = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-usability';

const ssotContent = fs.readFileSync(ssotPath, 'utf8');
const groupRegex = /### \d+\. (\w+)\r?\n(.*?)(?=\r?\n### |\r?\n## |\Z)/gs;

const validTools = new Set();
const groupTools = {};

let match;
while ((match = groupRegex.exec(ssotContent)) !== null) {
    const groupName = match[1];
    const toolsStr = match[2].trim();
    const tools = toolsStr.split(',').map(t => t.trim()).filter(t => t);
    groupTools[groupName] = tools;
    tools.forEach(t => validTools.add(t));
}

function auditDir(dir) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'README.md' && !f.includes('coordinator-workflow'));
    let foundTools = new Set();
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const size = content.length;
        const lines = content.split('\n').length;
        
        const toolsMatch = content.match(/Explicit Tool Coverage Requirements[\s\S]*?(?=\n## |\Z)/);
        let extractedTools = [];
        if (toolsMatch) {
            const matches = toolsMatch[0].match(/- (mysql_\w+|proxysql_\w+|mysqlsh_\w+)/g);
            if (matches) {
                extractedTools = matches.map(m => m.replace('- ', '').trim());
            }
        }
        
        extractedTools.forEach(t => foundTools.add(t));
        
        const hallucinated = extractedTools.filter(t => !validTools.has(t));
        
        console.log(`[${dir.split('\\').pop()}] ${file} - ${lines} lines (${size} bytes) - ${extractedTools.length} tools`);
        if (hallucinated.length > 0) {
            console.log(`  HALLUCINATED: ${hallucinated.join(', ')}`);
        }
    });

    console.log(`\nMissing from ${dir.split('\\').pop()}:`);
    for (const [group, tools] of Object.entries(groupTools)) {
        const missing = tools.filter(t => !foundTools.has(t));
        if (missing.length > 0) {
            console.log(`  Group ${group}: missing ${missing.join(', ')}`);
        }
    }
}

console.log("=== AUDIT ADVANCED ===");
auditDir(testAdvanced);

console.log("\n=== AUDIT USABILITY ===");
auditDir(testUsability);

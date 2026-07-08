const fs = require('fs');
const path = require('path');

const testDir = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-codemode';
const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.md') && f.startsWith('test-codemode-'));

const missingInTests = [];
const hallucinatedInTests = [];

for (const file of testFiles) {
  const content = fs.readFileSync(path.join(testDir, file), 'utf8');
  
  // Extract explicit tools
  const explicitSection = content.split('### Explicit Tool Coverage Requirements')[1];
  const explicitTools = [];
  if (explicitSection) {
    const lines = explicitSection.split('## Group Focus')[0].split('\n');
    for (const line of lines) {
      if (line.trim().startsWith('- `')) {
        const match = line.match(/`([^`]+)`/);
        if (match) explicitTools.push(match[1]);
      }
    }
  }

  // Extract tools used in group focus
  const groupFocusSection = content.split('## Group Focus')[1];
  const testScriptTools = new Set();
  
  if (groupFocusSection) {
    // Regex to find tool names in the javascript-like test script or anywhere in the group focus
    // We can look for tools in explicitTools to see if they appear in groupFocusSection text
    for (const tool of explicitTools) {
      // For codemode, it's typically called via some alias or just look for the camelCase equivalent, 
      // but wait, codemode executes JS. 
      // e.g. mysql_server_config -> mysql.admin.serverConfig
      // A simple way is to check if the tool name or its JS equivalent is in the text.
      // But maybe we can just look for the word?
      // Actually, let's just see if the words in the tool name exist.
      const camelCase = tool.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/^mysql_/, '');
      const camelCase2 = tool.replace(/_([a-z])/g, (g) => g[1].toUpperCase()).replace(/^(mysql|proxysql|mysqlsh)_/, '');
      
      if (!groupFocusSection.includes(camelCase) && !groupFocusSection.includes(camelCase2) && !groupFocusSection.includes(tool)) {
        missingInTests.push({ file, tool });
      }
    }
  } else {
     console.log('No Group Focus in', file);
  }
}

console.log('--- Tools missing in actual test scripts:');
console.log(missingInTests);

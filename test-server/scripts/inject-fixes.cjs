const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dirs = ['test-codemode', 'test-advanced', 'test-tool-groups'];
const basePath = path.join(process.cwd(), 'test-server');

dirs.forEach(d => {
  const p = path.join(basePath, d);
  if (!fs.existsSync(p)) return;
  fs.readdirSync(p).filter(f => f.endsWith('.md')).forEach(f => {
    let t = fs.readFileSync(path.join(p, f), 'utf8');
    
    let currentLines = t.split("\n");
    let currentPostTestIdx = currentLines.findIndex(l => l.startsWith("## Post-Test"));
    if (currentPostTestIdx === -1) return;
    
    let currentLastDashes = -1;
    for (let i = currentPostTestIdx - 1; i >= 0; i--) {
        if (currentLines[i].trim() === "---") {
            currentLastDashes = i;
            break;
        }
    }
    
    if (currentLastDashes === -1) return;
    
    let currentFirstDashes = -1;
    for (let i = currentLastDashes - 1; i >= 0; i--) {
        if (currentLines[i].trim() === "---") {
            currentFirstDashes = i;
            break;
        }
    }
    
    if (currentFirstDashes === -1) return;
    
    let currentBlock = currentLines.slice(currentFirstDashes + 1, currentLastDashes).join("").trim();
    if (currentBlock.length > 50) {
        return; // Already fixed or not broken
    }
    
    const groupMatch = t.match(/# mysql-mcp .*: \[(.*?)\]/);
    if (!groupMatch) return;
    const groupName = groupMatch[1];
    let oldPath = '';
    if (d === 'test-codemode') oldPath = `test-server/test-tool-groups-codemode/test-tool-group-codemode-${groupName}.md`;
    else if (d === 'test-advanced') oldPath = `test-server/test-advanced/test-tools-advanced-${groupName}.md`;
    else oldPath = `test-server/test-tool-groups/test-tool-group-${groupName}.md`;
    
    try {
        const oldContent = execSync(`git show f6762c1:"${oldPath}"`).toString();
        const lines = oldContent.split('\n');
        
        let testStartIdx = lines.findIndex(l => l.startsWith("## Group Focus:") || l.startsWith("## Category 1:"));
        if (testStartIdx === -1) {
            testStartIdx = lines.findIndex(l => l.startsWith("### " + groupName + " Group-Specific Testing") || l.startsWith("## Tests:"));
        }
        
        if (testStartIdx === -1) {
            console.log("Could not find start in old file for", f);
            return;
        }

        // Only look for post-test AFTER the test start!
        let postTestIdx = lines.findIndex((l, i) => i > testStartIdx && (l.startsWith("## Post-Test") || l.startsWith("## P154")));
        let contentEndIdx = lines.length;

        if (contentEndIdx === lines.length && postTestIdx !== -1) {
            for (let i = postTestIdx - 1; i > testStartIdx; i--) {
                if (lines[i].trim() === "---") {
                    contentEndIdx = i;
                    break;
                }
            }
            if (contentEndIdx === lines.length) {
                contentEndIdx = postTestIdx;
            }
        }

        const testContent = lines.slice(testStartIdx, contentEndIdx).join("\n").trim();
        
        if (testContent.length === 0) {
             console.log("Extracted empty content for", f);
             return;
        }
        
        currentLines.splice(currentFirstDashes + 1, currentLastDashes - currentFirstDashes - 1, "\n" + testContent + "\n");
        fs.writeFileSync(path.join(p, f), currentLines.join("\n"), "utf8");
        console.log('Successfully injected ' + f);
    } catch (e) {
        console.log('Error fixing ' + f + ': ' + e.message);
    }
  });
});

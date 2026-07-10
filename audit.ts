import fs from 'fs';
import path from 'path';

const ssotPath = 'C:\\Users\\chris\\.gemini\\antigravity\\brain\\328e6f10-c693-4a06-b199-9f3514469604\\scratch\\ssot-mapping.md';
const toolRefPath = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\tool-reference.md';
const instructionsDir = 'C:\\Users\\chris\\Desktop\\mysql-mcp\\src\\constants\\server-instructions';

const ssotContent = fs.readFileSync(ssotPath, 'utf-8');
const toolRefContent = fs.readFileSync(toolRefPath, 'utf-8');

// Parse SSoT
const ssotGroups = new Map<string, string[]>();
let currentGroup = '';
for (const line of ssotContent.split('\n')) {
    if (line.startsWith('## ')) {
        currentGroup = line.substring(3).trim();
        ssotGroups.set(currentGroup, []);
    } else if (line.startsWith('- ') && currentGroup) {
        ssotGroups.get(currentGroup)!.push(line.substring(2).trim());
    }
}

// Parse tool reference
const toolRefs = new Map<string, string>(); // toolName -> description/parameters
for (const line of toolRefContent.split('\n')) {
    if (line.startsWith('| `')) {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length >= 3) {
            const toolNameMatch = parts[1].match(/`([^`]+)`/);
            if (toolNameMatch) {
                const toolName = toolNameMatch[1];
                let description = parts[2];
                if (parts.length >= 4 && parts[3]) {
                    description += ' ' + parts[3];
                }
                toolRefs.set(toolName, description);
            }
        }
    }
}

let report = "Audit Report:\n";

for (const file of fs.readdirSync(instructionsDir)) {
    if (!file.endsWith('.md') || file === 'README.md' || file === 'gotchas.md' || file === 'overview.md') continue;
    
    const groupName = file.replace('.md', '');
    const expectedTools = ssotGroups.get(groupName);
    if (!expectedTools) {
        report += `Group ${groupName} not found in SSoT\n`;
        continue;
    }

    const filePath = path.join(instructionsDir, file);
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check encapsulated tools line
    const encapsulatedRegex = /\*\*Encapsulated Tools\*\*: (.*)/;
    const match = content.match(encapsulatedRegex);
    
    if (match) {
        const currentToolsStr = match[1];
        const currentTools = currentToolsStr.split(',').map(s => s.replace(/`/g, '').trim()).filter(s => s);
        
        const missingInDoc = expectedTools.filter(t => !currentTools.includes(t));
        const hallucinated = currentTools.filter(t => !expectedTools.includes(t));
        
        if (missingInDoc.length > 0) report += `[${groupName}] Missing tools in Encapsulated Tools: ${missingInDoc.join(', ')}\n`;
        if (hallucinated.length > 0) report += `[${groupName}] Hallucinated tools in Encapsulated Tools: ${hallucinated.join(', ')}\n`;
        
        // Update encapsulated line
        const newEncapsulated = `**Encapsulated Tools**: ${expectedTools.map(t => `\`${t}\``).join(', ')}`;
        content = content.replace(encapsulatedRegex, newEncapsulated);
        
        // Also update the header if it lists tools
        const headerRegex = /# .*?\((.*?)\)/;
        const headerMatch = content.match(headerRegex);
        if (headerMatch) {
            const headerToolsStr = headerMatch[1];
            if (headerToolsStr.includes('`')) {
               // Just make sure it looks ok, maybe update to top 3-4
               const topTools = expectedTools.slice(0, 3).map(t => `\`${t}\``).join(', ');
               const newHeaderTools = topTools + (expectedTools.length > 3 ? ', etc.' : '');
               content = content.replace(headerRegex, (full, inner) => full.replace(inner, newHeaderTools));
            }
        }
    } else {
        report += `[${groupName}] Could not find **Encapsulated Tools** line\n`;
    }

    // Now check if all tools are mentioned in the body with their parameter descriptions
    let bodyUpdates = '';
    for (const tool of expectedTools) {
        const ref = toolRefs.get(tool);
        if (!content.includes(tool)) {
            report += `[${groupName}] Tool ${tool} is completely missing from the body documentation.\n`;
            if (ref) {
                bodyUpdates += `\n### \`${tool}\`\n- ${ref}\n`;
            }
        } else {
            // It's in the doc, let's see if we can find its documentation line.
            // If the tool reference mentions parameters, let's check if the doc mentions those parameters.
            if (ref && ref.includes('parameter')) {
                 const paramMatch = ref.match(/`(.*?)` parameter/g) || ref.match(/parameters/i);
                 if (paramMatch && !content.includes(tool + ' parameters') && !content.includes('limit parameter') && !content.includes('maxLength') && !content.includes('includeRedundant')) {
                    // It's hard to dynamically update unstructured text perfectly, so let's log it.
                    report += `[${groupName}] Tool ${tool} might be missing parameter documentation (Ref: ${ref}).\n`;
                 }
            }
        }
    }
    
    if (bodyUpdates) {
        content += `\n## Additional Tools\n${bodyUpdates}`;
    }

    fs.writeFileSync(filePath, content, 'utf-8');
}

fs.writeFileSync('audit-report.txt', report, 'utf-8');
console.log("Done");

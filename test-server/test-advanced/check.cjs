const fs = require('fs');
const path = require('path');

const ssot_file = 'C:\\\\Users\\\\chris\\\\.gemini\\\\antigravity\\\\brain\\\\ccc25abd-9fcf-4334-87db-34532b31b7ce\\\\scratch\\\\ssot-mapping.md';
const test_dir = 'C:\\\\Users\\\\chris\\\\Desktop\\\\mysql-mcp\\\\test-server\\\\test-advanced';

const ssot_content = fs.readFileSync(ssot_file, 'utf-8');
const ssot_tools = new Set();
for (const line of ssot_content.split('\n')) {
    if (line.startsWith('###') || line.startsWith('#') || !line.trim()) continue;
    const tools = line.split(',').map(t => t.trim()).filter(Boolean);
    for (const t of tools) ssot_tools.add(t);
}

const tested_tools = new Set();
const file_tool_mapping = {};
for (const filename of fs.readdirSync(test_dir)) {
    if (!filename.endsWith('.md') || !filename.startsWith('test-')) continue;
    
    const filepath = path.join(test_dir, filename);
    const content = fs.readFileSync(filepath, 'utf-8');
    
    let in_coverage = false;
    file_tool_mapping[filename] = [];
    for (const line of content.split('\n')) {
        if (line.includes('### Explicit Tool Coverage Requirements')) {
            in_coverage = true;
            continue;
        }
        if (in_coverage) {
            if (line.startsWith('## ')) {
                in_coverage = false;
            } else if (line.trim().startsWith('- ')) {
                const tool_name = line.trim().substring(2).replace(/`/g, '').trim();
                if (tool_name && (tool_name.startsWith('mysql') || tool_name.startsWith('proxysql'))) {
                    tested_tools.add(tool_name);
                    file_tool_mapping[filename].push(tool_name);
                }
            }
        }
    }
}

const missing = [...ssot_tools].filter(t => !tested_tools.has(t)).sort();
const extra = [...tested_tools].filter(t => !ssot_tools.has(t)).sort();

console.log('Missing in tests:', missing.length);
missing.forEach(t => console.log('  ' + t));

console.log('\nExtra in tests:', extra.length);
extra.forEach(t => console.log('  ' + t));

console.log('\nFiles with >= 8 tools:');
for (const [fname, tools] of Object.entries(file_tool_mapping)) {
    if (tools.length >= 8) {
        console.log(`  ${fname}: ${tools.length} tools`);
    }
}

const fs = require('fs');
const path = require('path');

const ssotMappingRaw = fs.readFileSync('C:/Users/chris/.gemini/antigravity/brain/e29c3c6b-3e6f-441c-a21d-bf69e3dcf35d/scratch/ssot-mapping.md', 'utf8');
const ssotGroups = {};
let allSsotTools = new Set();

const groupRegex = /### \d+\. (\w+)\r?\n(.*?)(?=\r?\n### |\r?\n## |\Z)/gs;
let match;
while ((match = groupRegex.exec(ssotMappingRaw)) !== null) {
    const groupName = match[1];
    const toolsStr = match[2].trim();
    const tools = toolsStr.split(',').map(t => t.trim()).filter(t => t);
    ssotGroups[groupName] = tools;
    tools.forEach(t => allSsotTools.add(t));
}

function auditDir(dir) {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'coordinator-workflow.md' && f !== 'README.md');

    const fileTools = {};
    const groupToFiles = {};
    const allFileTools = new Set();

    files.forEach(file => {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        let toolsMatch = '';
        
        if (dir.includes('test-advanced')) {
            const m = content.match(/Explicit Tool Coverage Requirements[\s\S]*?(?=\n## |\Z)/);
            if (m) toolsMatch = m[0];
        } else if (dir.includes('test-usability')) {
            const m = content.match(/following tools in the .* group:[\s\S]*?(?=\n## |\Z)/);
            if (m) toolsMatch = m[0];
        }

        const toolRegex = /(?:mysql|proxysql|mysqlsh)_[a-z0-9_]+/g;
        const toolsInFile = new Set();
        let m2;
        while ((m2 = toolRegex.exec(toolsMatch)) !== null) {
            toolsInFile.add(m2[0]);
            allFileTools.add(m2[0]);
        }
        fileTools[file] = Array.from(toolsInFile);
        
        let group = 'unknown';
        const parts = path.basename(file, '.md').split('-');
        if (parts.includes('json')) group = 'json';
        else if (parts.includes('proxysql')) group = 'proxysql';
        else if (parts.includes('shell')) group = 'shell';
        else if (parts.includes('sysschema') || parts.includes('sys')) group = 'sysschema';
        else if (parts.includes('stats')) group = 'stats';
        else if (parts.includes('router')) group = 'router';
        else if (parts.includes('schema')) group = 'schema';
        else if (parts.includes('spatial')) group = 'spatial';
        else if (parts.includes('cluster')) group = 'cluster';
        else if (parts.includes('roles')) group = 'roles';
        else if (parts.includes('docstore')) group = 'docstore';
        else if (parts.includes('vector')) group = 'vector';
        else if (parts.includes('performance')) group = 'performance';
        else if (parts.includes('admin')) group = 'admin';
        else if (parts.includes('monitoring')) group = 'monitoring';
        else if (parts.includes('backup')) group = 'backup';
        else if (parts.includes('security')) group = 'security';
        else if (parts.includes('core')) group = 'core';
        else if (parts.includes('transactions')) group = 'transactions';
        else if (parts.includes('optimization')) group = 'optimization';
        else if (parts.includes('partitioning')) group = 'partitioning';
        else if (parts.includes('fulltext')) group = 'fulltext';
        else if (parts.includes('text')) group = 'text';
        else if (parts.includes('events')) group = 'events';
        else if (parts.includes('introspection')) group = 'introspection';
        else if (parts.includes('migration')) group = 'migration';
        else if (parts.includes('replication')) group = 'replication';
        else if (parts.includes('versioning')) group = 'core';
        else if (parts.includes('concurrency') || parts.includes('sessions') || parts.includes('sandbox') || parts.includes('codemode')) group = 'codemode';
        
        if (!groupToFiles[group]) groupToFiles[group] = [];
        groupToFiles[group].push(file);
    });

    console.log(`\n=== DIR: ${dir.split('\\').pop()} ===`);
    const hallucinated = Array.from(allFileTools).filter(t => !allSsotTools.has(t));
    if (hallucinated.length > 0) {
        console.log('Hallucinated Tools:', hallucinated.join(', '));
    } else {
        console.log('No hallucinated tools.');
    }

    for (const [group, tools] of Object.entries(ssotGroups)) {
        const filesForGroup = groupToFiles[group] || [];
        const toolsInGroupFiles = new Set();
        filesForGroup.forEach(f => {
            fileTools[f].forEach(t => toolsInGroupFiles.add(t));
        });
        
        const groupOmitted = tools.filter(t => !toolsInGroupFiles.has(t));
        if (groupOmitted.length > 0) {
            console.log(`[Group: ${group}] Omitted tools: ${groupOmitted.join(', ')}`);
        }
    }
}

auditDir('C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-advanced');
auditDir('C:\\Users\\chris\\Desktop\\mysql-mcp\\test-server\\test-usability');

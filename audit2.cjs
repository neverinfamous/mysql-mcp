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
        const toolRegex = /(?:mysql|proxysql|mysqlsh)_[a-z0-9_]+/g;
        const toolsInFile = new Set();
        let m;
        while ((m = toolRegex.exec(content)) !== null) {
            toolsInFile.add(m[0]);
            allFileTools.add(m[0]);
        }
        fileTools[file] = Array.from(toolsInFile);
        
        let group = 'unknown';
        if (file.includes('json')) group = 'json';
        else if (file.includes('proxysql')) group = 'proxysql';
        else if (file.includes('mysqlsh') || file.includes('shell')) group = 'shell';
        else if (file.includes('sys-')) group = 'sysschema';
        else if (file.includes('stats-')) group = 'stats';
        else if (file.includes('router-')) group = 'router';
        else if (file.includes('schema-')) group = 'schema';
        else if (file.includes('spatial-')) group = 'spatial';
        else if (file.includes('cluster-')) group = 'cluster';
        else if (file.includes('roles-')) group = 'roles';
        else if (file.includes('docstore-')) group = 'docstore';
        else if (file.includes('vector-')) group = 'vector';
        else if (file.includes('performance-')) group = 'performance';
        else if (file.includes('admin-')) group = 'admin';
        else if (file.includes('monitoring-')) group = 'monitoring';
        else if (file.includes('backup-')) group = 'backup';
        else if (file.includes('security-')) group = 'security';
        else if (file.includes('core-')) group = 'core';
        else if (file.includes('transactions-')) group = 'transactions';
        else if (file.includes('optimization-')) group = 'optimization';
        else if (file.includes('partitioning-')) group = 'partitioning';
        else if (file.includes('text-')) group = 'text';
        else if (file.includes('fulltext-')) group = 'fulltext';
        else if (file.includes('events-')) group = 'events';
        else if (file.includes('introspection-')) group = 'introspection';
        else if (file.includes('migration-')) group = 'migration';
        else if (file.includes('replication-')) group = 'replication';
        else if (file.includes('versioning')) group = 'core';
        else if (file.includes('concurrency') || file.includes('sessions') || file.includes('sandbox') || file.includes('codemode')) group = 'codemode';
        
        if (!groupToFiles[group]) groupToFiles[group] = [];
        groupToFiles[group].push(file);
    });

    console.log(`\n=== DIR: ${dir.split('\\').pop()} ===`);
    const hallucinated = Array.from(allFileTools).filter(t => !allSsotTools.has(t));
    console.log('Hallucinated Tools:', hallucinated.join(', '));

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

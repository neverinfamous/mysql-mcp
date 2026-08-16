import { execFileSync } from 'child_process';
import { detectDocker, resolveScriptPaths } from './utils.mjs';

const { __dirname, ecosystemRoot } = resolveScriptPaths(import.meta.url);

// 🚨 AGENT INSTRUCTION: Do NOT remove detectDocker().
// This is required to route Docker commands into WSL when Docker Desktop is not installed on the Windows host.
const { dockerCmd, dockerBaseArgs } = detectDocker();

console.log(`\n=== MySQL-MCP Cluster Healer ===`);
console.log(`Attempting to fix super_read_only lock on primary node...`);

let servicesRaw = '';
try {
    servicesRaw = execFileSync(dockerCmd, [...dockerBaseArgs, 'compose', 'config', '--services'], { encoding: 'utf-8', cwd: ecosystemRoot }).trim();
} catch(e) {
    console.error(`❌ Failed to execute docker compose config --services`);
    process.exit(1);
}
const mysqlNodes = servicesRaw.split('\n').filter(s => s.startsWith('mysql-node')).sort();
if (mysqlNodes.length === 0) {
    console.error(`❌ Could not dynamically discover any mysql-node containers.`);
    process.exit(1);
}

try {
    // 1. Identify current primary
    const primaryOut = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', mysqlNodes[0], 'mysql', '-uroot', '-N', '-s', '-e', "SELECT member_host FROM performance_schema.replication_group_members WHERE member_role='PRIMARY';"], { encoding: 'utf-8', stdio: 'pipe' });
    let currentPrimary = primaryOut.trim();
    if (currentPrimary.includes('mysql: [Warning]')) {
        currentPrimary = currentPrimary.split('\n').pop().trim();
    }
    
    if (!currentPrimary) {
        console.error(`❌ Could not identify current primary node.`);
        process.exit(1);
    }
    
    // Pick a secondary to cycle to
    if (mysqlNodes.length < 2) {
        console.error('Not enough MySQL nodes to cycle primary');
        process.exit(1);
    }
    const secondaryToCycle = currentPrimary === mysqlNodes[0] ? mysqlNodes[1] : mysqlNodes[0];

    console.log(`Current Primary: ${currentPrimary}`);
    console.log(`Cycling primary election to ${secondaryToCycle} and back to force state reset...`);

    const jsPayload = `
var c = dba.getCluster('mcpCluster');
print('\\nSwitching to ${secondaryToCycle}...');
c.setPrimaryInstance('${secondaryToCycle}:3306');
print('\\nSwitching back to ${currentPrimary}...');
c.setPrimaryInstance('${currentPrimary}:3306');
print('\\nCycle complete.');
`;
    
    execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', mysqlNodes[0], 'mysqlsh', '--user=root', '--password=root', '--host=127.0.0.1', '--port=3306', '--js', '-e', jsPayload], { encoding: 'utf-8', stdio: 'inherit' });
    
    // Verify
    let readOnlyCheck = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', currentPrimary, 'mysql', '-uroot', '-N', '-s', '-e', "SELECT @@super_read_only;"], { encoding: 'utf-8', stdio: 'pipe' });
    if (readOnlyCheck.includes('mysql: [Warning]')) {
        readOnlyCheck = readOnlyCheck.split('\n').pop().trim();
    }
    
    if (readOnlyCheck.trim() === '0') {
        console.log(`\n✅ Successfully cleared super_read_only flag on ${currentPrimary}!`);
    } else {
        console.log(`\n❌ Failed to clear super_read_only flag on ${currentPrimary}. (super_read_only=${readOnlyCheck.trim()})`);
        process.exit(1);
    }
} catch (e) {
    console.error(`\n❌ Healing failed: ${e.message}`);
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
    process.exit(1);
}

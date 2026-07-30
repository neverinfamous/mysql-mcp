import { execFileSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dockerCmd = 'docker';
const dockerBaseArgs = [];
if (process.platform === 'win32') {
    dockerCmd = 'wsl';
    dockerBaseArgs.push('docker');
}

console.log(`\n=== MySQL-MCP Cluster Healer ===`);
console.log(`Attempting to fix super_read_only lock on primary node...`);

try {
    // 1. Identify current primary
    const primaryOut = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', 'mysql-node1', 'mysql', '-uroot', '-N', '-s', '-e', "SELECT member_host FROM performance_schema.replication_group_members WHERE member_role='PRIMARY';"], { encoding: 'utf-8', stdio: 'pipe' });
    let currentPrimary = primaryOut.trim();
    if (currentPrimary.includes('mysql: [Warning]')) {
        currentPrimary = currentPrimary.split('\n').pop().trim();
    }
    
    if (!currentPrimary) {
        console.error(`❌ Could not identify current primary node.`);
        process.exit(1);
    }
    
    // Pick a secondary to cycle to
    const secondaryToCycle = currentPrimary === 'mysql-node1' ? 'mysql-node2' : 'mysql-node1';

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
    
    execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', 'mysql-node1', 'mysqlsh', '--user=root', '--password=root', '--host=127.0.0.1', '--port=3306', '--js', '-e', jsPayload], { encoding: 'utf-8', stdio: 'inherit' });
    
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

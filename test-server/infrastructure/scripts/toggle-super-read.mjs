import { execFileSync } from 'child_process';
import { detectDocker, resolveScriptPaths } from './utils.mjs';

function main() {
    // 🚨 AGENT INSTRUCTION: Do NOT remove detectDocker().
    // This is required to route Docker commands into WSL when Docker Desktop is not installed on the Windows host.
    const { dockerCmd, dockerBaseArgs } = detectDocker();
    const { ecosystemRoot } = resolveScriptPaths(import.meta.url);
    console.log(`Connecting to primary node via docker exec...`);
    
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
    const container = mysqlNodes[0];

    const arg = process.argv[2]?.toUpperCase();

    try {
        if (arg === 'STATUS') {
            // Just read, don't execute a SET
        } else if (arg === 'ON') {
            execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', container, 'mysql', '-uroot', '-e', 'SET GLOBAL super_read_only = 1;'], { encoding: 'utf-8' });
        } else if (arg === 'OFF') {
            execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', container, 'mysql', '-uroot', '-e', 'SET GLOBAL super_read_only = 0, read_only = 0;'], { encoding: 'utf-8' });
        } else {
            // Toggle (default behavior)
            execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', container, 'mysql', '-uroot', '-e', 'SET GLOBAL super_read_only = NOT @@global.super_read_only, read_only = NOT @@global.super_read_only;'], { encoding: 'utf-8' });
        }
        
        // Fetch current state
        const out = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', container, 'mysql', '-uroot', '-N', '-s', '-e', 'SELECT @@global.super_read_only'], { encoding: 'utf-8' });
        
        let state = out.trim();
        if (state.includes('mysql: [Warning]')) {
            state = state.split('\n').pop().trim();
        }
        
        if (arg === 'STATUS') {
            console.log(`Current state: ${state}`);
        } else {
            console.log(`Success! Current state: ${state}`);
        }
    } catch (error) {
        console.error('Error with super_read_only command:', error.message);
        if (error.stderr) console.error(error.stderr.toString());
        process.exit(1);
    }
}

main();

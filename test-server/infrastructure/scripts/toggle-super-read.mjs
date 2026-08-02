import { execFileSync } from 'child_process';
import { detectDocker } from './utils.mjs';

function main() {
    const { dockerCmd, dockerBaseArgs } = detectDocker();
    console.log(`Connecting to primary node via docker exec...`);
    
    let servicesRaw = '';
    try {
        servicesRaw = execFileSync(dockerCmd, [...dockerBaseArgs, 'config', '--services'], { encoding: 'utf-8' }).trim();
    } catch(e) {}
    const mysqlNodes = servicesRaw.split('\n').filter(s => s.startsWith('mysql-node')).sort();
    if (mysqlNodes.length === 0) mysqlNodes.push('mysql-node1');
    const container = mysqlNodes[0];

    try {
        // Toggle
        execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', container, 'mysql', '-uroot', '-e', 'SET GLOBAL super_read_only = NOT @@global.super_read_only'], { encoding: 'utf-8' });
        
        // Fetch new state
        const out = execFileSync(dockerCmd, [...dockerBaseArgs, 'exec', '-e', 'MYSQL_PWD=root', container, 'mysql', '-uroot', '-N', '-s', '-e', 'SELECT @@global.super_read_only'], { encoding: 'utf-8' });
        
        let state = out.trim();
        if (state.includes('mysql: [Warning]')) {
            state = state.split('\n').pop().trim();
        }
        
        console.log(`Success! Current state: ${state}`);
    } catch (error) {
        console.error('Error toggling super_read_only:', error.message);
        if (error.stderr) console.error(error.stderr.toString());
        process.exit(1);
    }
}

main();

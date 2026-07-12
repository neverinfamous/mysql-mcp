import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const dockerCmd = 'docker';

const execCommand = (cmd, args, ignoreError = false) => {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    if (!ignoreError) {
      console.error(`Error: ${e.message}`);
    }
    return null;
  }
};


// Dynamically discover expected containers from docker-compose.yml
let servicesRaw = execCommand('docker', ['compose', 'config', '--services'], true);
if (!servicesRaw) {
    servicesRaw = execCommand('docker-compose', ['config', '--services'], true);
}

let containers = [];
if (servicesRaw) {
    containers = servicesRaw.trim().split('\n').filter(Boolean).sort();
} else {
    // Ultimate fallback: manually parse docker-compose.yml
    try {
        let yamlContent = fs.readFileSync('docker-compose.yml', 'utf-8');
        let lines = yamlContent.split('\n');
        let inServices = false;
        for (let line of lines) {
            if (line.startsWith('services:')) {
                inServices = true;
                continue;
            }
            if (inServices) {
                if (line.match(/^[a-zA-Z]/)) break; // Next top-level block
                let match = line.match(/^  ([a-zA-Z0-9_-]+):/);
                if (match) {
                    containers.push(match[1]);
                }
            }
        }
        containers.sort();
    } catch (e) {
        console.error('Failed to read docker-compose.yml services. Are you in the infrastructure directory?');
        process.exit(1);
    }
    
    if (containers.length === 0) {
        console.error('Failed to parse any services from docker-compose.yml. Are you in the infrastructure directory?');
        process.exit(1);
    }
}

console.log('=== Ecosystem Status Check ===\n');

console.log(`1. Container Status (${containers.length} services):`);
console.log('----------------------------------------');
let allUp = true;

const psOutput = execCommand(dockerCmd, ['ps', '-a', '--format', '{{.Names}}|{{.State}}|{{.Status}}'], false);
if (psOutput === null) {
    console.error('Failed to get docker ps output. Is docker running?');
    process.exit(1);
}

const runningContainers = psOutput.trim().split('\n').reduce((acc, line) => {
    const [name, state, status] = line.split('|');
    if (name) {
        acc[name] = { state, status };
    }
    return acc;
}, {});

for (const name of containers) {
    const info = runningContainers[name];
    if (info) {
        let displayStatus = info.status;
        let icon = '✅';
        if (info.state !== 'running') {
            icon = '❌';
            displayStatus = `Down (${info.state})`;
            allUp = false;
        } else if (info.status.includes('unhealthy')) {
            icon = '⚠️';
            allUp = false;
        } else if (info.status.includes('health: starting')) {
            icon = '⏳';
            allUp = false;
        }
        console.log(`${icon} ${name.padEnd(20)} : ${displayStatus}`);
    } else {
        console.log(`❌ ${name.padEnd(20)} : Not Found / Offline`);
        allUp = false;
    }
}

console.log('\n2. InnoDB Cluster Status:');
console.log('----------------------------------------');

const clusterOut = execCommand(dockerCmd, ['exec', 'mysql-node1', 'mysql', '-uroot', '-proot', '-e', 'SELECT member_state FROM performance_schema.replication_group_members;'], false);
if (clusterOut !== null) {
    const onlineCount = (clusterOut.match(/ONLINE/g) || []).length;
    if (onlineCount >= 3) {
        console.log(`✅ Cluster Quorum is ONLINE (${onlineCount} nodes)`);
    } else {
        console.log(`⚠️ Cluster Quorum is DEGRADED. Only ${onlineCount} nodes ONLINE.\nDetails:\n${clusterOut.replace(/mysql: \[Warning\].*\n/g, '').trim()}`);
        allUp = false;
    }
} else {
    console.log('❌ Failed to retrieve cluster status.');
    allUp = false;
}

console.log('\n========================================');
if (allUp) {
    console.log('🎉 Ecosystem is fully healthy and ready for testing!');
} else {
    console.log('⚠️ Ecosystem has issues. Please resolve them before testing.');
    process.exit(1);
}

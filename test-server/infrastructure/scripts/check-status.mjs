import { execSync } from 'child_process';

const dockerCmd = 'docker';

const execCommand = (cmd, ignoreError = false) => {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    if (!ignoreError) {
      console.error(`Error: ${e.message}`);
    }
    return null;
  }
};

// Dynamically discover expected containers from docker-compose.yml
const servicesRaw = execCommand(`docker compose config --services`, false);
if (!servicesRaw) {
    console.error('Failed to read docker-compose.yml services. Are you in the infrastructure directory?');
    process.exit(1);
}
const containers = servicesRaw.trim().split('\n').filter(Boolean).sort();

console.log('=== Ecosystem Status Check ===\n');

console.log(`1. Container Status (${containers.length} services):`);
console.log('----------------------------------------');
let allUp = true;

const psOutput = execCommand(`${dockerCmd} ps -a --format "{{.Names}}|{{.State}}|{{.Status}}"`, true);
if (!psOutput) {
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

const statusCmd = `${dockerCmd} exec mysql-node1 mysql -uroot -proot -e "SELECT member_state FROM performance_schema.replication_group_members;"`;

const clusterOut = execCommand(statusCmd, false);
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

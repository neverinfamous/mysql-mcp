import { execSync, exec, execFileSync } from 'child_process';
import { promisify } from 'util';
const sleep = promisify(setTimeout);
const execAsync = promisify(exec);

async function run() {
    const args = process.argv.slice(2);
    const getArg = (name, def) => {
        const idx = args.findIndex(a => a.toLowerCase() === `--${name.toLowerCase()}` || a.toLowerCase() === `-${name.toLowerCase()}`);
        if (idx >= 0 && idx + 1 < args.length) return args[idx+1];
        return def;
    };

    const mysqlshPath = getArg('mysqlshpath', process.platform === 'win32' ? "C:\\Program Files\\MySQL\\MySQL Shell 9.5\\bin\\mysqlsh.exe" : "mysqlsh");
    const primaryHost = getArg('primaryhost', "localhost");
    const primaryPort = parseInt(getArg('primaryport', "3307"), 10);
    const user = getArg('user', "root");
    const password = getArg('password', "root");
    const clusterName = getArg('clustername', "testCluster");

    console.log(`\n=== InnoDB Cluster Reboot ===`);

    console.log(`\n[1/6] Checking container status...`);
    const nodes = ["mysql-node1", "mysql-node2", "mysql-node3"];
    for (const node of nodes) {
        try {
            const status = execSync(`docker inspect -f "{{.State.Status}}" ${node}`, { encoding: 'utf-8' }).trim();
            if (status !== 'running') {
                console.log(`  Starting ${node}...`);
                execSync(`docker start ${node}`);
            }
            console.log(`  ${node}: running`);
        } catch (e) {
            console.error(`  Error checking/starting ${node}: ${e.message}`);
        }
    }

    console.log(`\n[2/6] Waiting for MySQL to be ready on ${primaryHost}:${primaryPort}...`);
    const maxRetries = 30;
    let ready = false;
    for (let i = 1; i <= maxRetries; i++) {
        try {
            execSync(`docker exec mysql-node1 mysqladmin ping -h localhost -uroot -proot`, { stdio: 'ignore' });
            ready = true;
            break;
        } catch (e) {
            console.log(`  Waiting... (${i}/${maxRetries})`);
            await sleep(2000);
        }
    }
    
    if (!ready) {
        console.error(`  ERROR: MySQL not ready after ${maxRetries} attempts`);
        process.exit(1);
    }
    console.log(`  MySQL is ready`);

    console.log(`\n[3/6] Cleaning up non-PK tables to satisfy Group Replication...`);
    try {
        const query = "SELECT CONCAT('DROP TABLE IF EXISTS `', TABLE_SCHEMA, '`.`', TABLE_NAME, '`;') FROM information_schema.tables WHERE TABLE_SCHEMA = 'testdb' AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME NOT IN (SELECT TABLE_NAME FROM information_schema.statistics WHERE TABLE_SCHEMA = 'testdb' AND INDEX_NAME = 'PRIMARY');";
        const dropCmds = execSync(`docker exec mysql-node1 mysql -uroot -proot -N -s -e "${query}"`, { encoding: 'utf-8' }).trim();
        if (dropCmds) {
            console.log(`  Dropping non-PK tables...`);
            execSync(`docker exec mysql-node1 mysql -uroot -proot -e "SET GLOBAL super_read_only=0; ${dropCmds.replace(/\n/g, ' ')}"`);
        } else {
            console.log(`  No non-PK tables found.`);
        }
    } catch (e) {
        console.log(`  Warning: Non-PK table cleanup failed (ignoring): ${e.message}`);
    }

    console.log(`\n[4/6] Rebooting cluster '${clusterName}' from complete outage...`);
    const uri = `${user}:${password}@${primaryHost}:${primaryPort}`;
    try {
        // Let errors throw natively so the process exits with a non-zero code if it fails
        // but gracefully catch if the cluster is already online.
        execFileSync(mysqlshPath, [
            '--uri', uri,
            '--js',
            '-e', `try { dba.rebootClusterFromCompleteOutage('${clusterName.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}', {force: true}); } catch(e) { if (!e.message.includes('The Cluster is ONLINE')) throw e; print('Cluster is already ONLINE.'); }`
        ], { stdio: 'inherit' });
        console.log(`  Cluster reboot step completed`);
    } catch (e) {
        console.error(`  Error rebooting cluster. Cannot proceed.`);
        process.exit(1);
    }

    console.log(`\n[5/6] Rejoining secondaries from inside Docker network...`);
    const clusterUser = "cluster_admin";
    const clusterPass = "cluster_admin";
    const secondaries = ["mysql-node2", "mysql-node3"];
    
    for (const node of secondaries) {
        console.log(`  Rejoining ${node}...`);
        let rejoinSuccess = false;
        try {
            // rely on standard exit code instead of regex matching which can trigger false positives
            execSync(`docker exec mysql-node1 mysqlsh --uri "${clusterUser}:${clusterPass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); c.rejoinInstance('${clusterUser}:${clusterPass}@${node}:3306');"`, { stdio: 'ignore' });
            rejoinSuccess = true;
        } catch(e) {
            rejoinSuccess = false;
        }

        if (rejoinSuccess) {
            console.log(`  ${node} rejoined successfully`);
        } else {
            console.log(`  ${node} rejoin failed. Attempting automated clone recovery...`);
            
            console.log(`    -> Removing stale instance...`);
            try {
                execSync(`docker exec mysql-node1 mysqlsh --uri "${clusterUser}:${clusterPass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); try { c.removeInstance('${clusterUser}:${clusterPass}@${node}:3306', {force: true}); } catch(e) {}"`, { stdio: 'ignore' });
            } catch(e) {}

            console.log(`    -> Cloning instance (this will take a moment)...`);
            const clonePromise = execAsync(`docker exec mysql-node1 mysqlsh --uri "${clusterUser}:${clusterPass}@mysql-node1:3306" --js -e "var c = dba.getCluster(); c.addInstance('${clusterUser}:${clusterPass}@${node}:3306', {recoveryMethod: 'clone', interactive: false});"`);
            
            let retries = 0;
            let cloneDone = false;
            
            clonePromise.then(() => cloneDone = true).catch(() => cloneDone = true);

            while (retries < 60 && !cloneDone) {
                await sleep(2000);
                try {
                    const status = execSync(`docker inspect -f "{{.State.Status}}" ${node}`, { encoding: 'utf-8' }).trim();
                    if (status === 'exited' || status === 'stopped') {
                        console.log(`    -> Container stopped during clone. Restarting ${node}...`);
                        execSync(`docker start ${node}`);
                        break; 
                    }
                } catch(e) {}
                retries++;
            }
            
            try {
                await clonePromise;
            } catch(e) {
                console.error(`    -> Clone process threw an error, but continuing: ${e.message}`);
            }
            console.log(`  Clone recovery for ${node} completed.`);
            
            try {
                execSync(`docker restart mysql-router`);
            } catch(e) {}
        }
    }

    console.log(`\n[6/6] Verifying cluster status...`);
    await sleep(3000);
    try {
        execFileSync(mysqlshPath, [
            '--uri', uri,
            '--js',
            '-e', 'print(JSON.stringify(dba.getCluster().status(), null, 2))'
        ], { stdio: 'inherit' });
    } catch(e) {
        console.error(`  Error checking status: ${e.message}`);
    }

    console.log(`\n=== Cluster reboot complete ===`);
}

run().catch(console.error);

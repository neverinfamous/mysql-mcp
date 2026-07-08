import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';

const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;
const dockerCmd = process.platform === 'win32' ? 'wsl docker' : 'docker';

const execCommand = (cmd, ignoreError = false) => {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
  } catch (e) {
    if (!ignoreError) {
      console.error(`Error: ${e.message}`);
      if (e.stdout) console.log(e.stdout.toString());
      if (e.stderr) console.error(e.stderr.toString());
      throw e;
    }
    return null;
  }
};

const waitForMySQL = async (containerName) => {
  console.log(`[Wait] Waiting for MySQL in ${containerName} to be ready...`);
  for (let i = 1; i <= MAX_RETRIES; i++) {
    const out = execCommand(`${dockerCmd} exec ${containerName} mysqladmin ping -h 127.0.0.1 -uroot -proot`, true);
    if (out && out.includes('mysqld is alive')) {
      console.log(`[Wait] ${containerName} is ready!`);
      return true;
    }
    console.log(`[Wait] ${containerName} not ready yet... (Attempt ${i}/${MAX_RETRIES})`);
    await setTimeout(RETRY_DELAY_MS);
  }
  throw new Error(`Timeout waiting for ${containerName} to become ready.`);
};

async function main() {
  console.log("=== InnoDB Cluster Creation Workflow ===");

  try {
    console.log("\n[1/4] Ensuring cluster nodes are healthy...");
    await waitForMySQL('mysql-node1');
    await waitForMySQL('mysql-node2');
    await waitForMySQL('mysql-node3');

    console.log("\n[2/4] Creating cluster on primary node...");
    const createCmd = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "try { dba.createCluster('testCluster', {localAddress: 'mysql-node1:33061', communicationStack: 'XCOM', exitStateAction: 'READ_ONLY'}); console.log('Cluster created'); } catch(e) { console.log('Cluster may already exist or error: ' + e); }"`;
    const createOut = execCommand(createCmd);
    console.log(createOut);

    console.log("\n[3/4] Adding node2 to cluster...");
    const addNode2 = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "try { var c = dba.getCluster('testCluster'); c.addInstance('root:root@mysql-node2:3306', {recoveryMethod: 'clone', localAddress: 'mysql-node2:33061', exitStateAction: 'READ_ONLY'}); } catch(e) { console.log('Node2 add error (may already be in cluster): ' + e); }"`;
    const node2Out = execCommand(addNode2, true);
    console.log(node2Out);

    // After clone, node2 might restart, wait for it
    await waitForMySQL('mysql-node2');

    console.log("\n[4/4] Adding node3 to cluster...");
    const addNode3 = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "try { var c = dba.getCluster('testCluster'); c.addInstance('root:root@mysql-node3:3306', {recoveryMethod: 'clone', localAddress: 'mysql-node3:33061', exitStateAction: 'READ_ONLY'}); } catch(e) { console.log('Node3 add error (may already be in cluster): ' + e); }"`;
    const node3Out = execCommand(addNode3, true);
    console.log(node3Out);

    // After clone, node3 might restart, wait for it
    await waitForMySQL('mysql-node3');

    console.log("\n=== Cluster configuration complete! ===");
    
    console.log("\nVerifying cluster status:");
    const statusCmd = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "console.log(JSON.stringify(dba.getCluster('testCluster').status(), null, 2));"`;
    const statusOut = execCommand(statusCmd, true);
    if (statusOut) {
      console.log(statusOut);
    }

  } catch (error) {
    console.error("\n❌ Cluster creation failed:", error.message);
    process.exit(1);
  }
}

main();

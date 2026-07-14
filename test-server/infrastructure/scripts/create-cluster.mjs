import { execSync } from 'child_process';
import { setTimeout } from 'timers/promises';

const MAX_RETRIES = 60;
const RETRY_DELAY_MS = 2000;
const dockerCmd = 'docker';

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
    let servicesRaw = execCommand(`${dockerCmd} compose config --services`, true);
    if (!servicesRaw) {
        servicesRaw = execCommand(`docker-compose config --services`, true);
    }
    let nodes = servicesRaw ? servicesRaw.trim().split('\n').filter(s => s.startsWith('mysql-node')).sort() : ['mysql-node1', 'mysql-node2', 'mysql-node3'];
    
    for (const node of nodes) {
        await waitForMySQL(node);
    }

    console.log("\n[2/4] Creating cluster on primary node...");
    const primaryNode = nodes[0];
    const createCmd = `${dockerCmd} exec ${primaryNode} mysqlsh --uri root:root@${primaryNode}:3306 --js -e "try { dba.createCluster('testCluster', {localAddress: '${primaryNode}:33061', communicationStack: 'XCOM', exitStateAction: 'READ_ONLY'}); console.log('Cluster created'); } catch(e) { console.log('Cluster may already exist or error: ' + e); }"`;
    const createOut = execCommand(createCmd);
    console.log(createOut);

    console.log("\n[3/4] Adding secondary nodes to cluster...");
    for (let i = 1; i < nodes.length; i++) {
        const node = nodes[i];
        console.log(`Adding ${node} to cluster...`);
        const addNode = `${dockerCmd} exec ${primaryNode} mysqlsh --uri root:root@${primaryNode}:3306 --js -e "try { var c = dba.getCluster('testCluster'); c.addInstance('root:root@${node}:3306', {recoveryMethod: 'clone', localAddress: '${node}:33061', exitStateAction: 'READ_ONLY'}); } catch(e) { console.log('${node} add error (may already be in cluster): ' + e); }"`;
        const nodeOut = execCommand(addNode, true);
        console.log(nodeOut);

        // After clone, node might restart, wait for it
        await waitForMySQL(node);
        console.log('[Wait] Allowing Group Replication to stabilize...');
        await setTimeout(5000);
    }

    console.log("\n=== Cluster configuration complete! ===");
    
    console.log("\nVerifying cluster status:");
    let statusCmd = `${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "console.log(JSON.stringify(dba.getCluster('testCluster').status(), null, 2));"`;
    let statusOut = execCommand(statusCmd, true);
    
    if (!statusOut || statusOut.includes('MYSQLSH 51314') || statusOut.includes('Error')) {
      console.log("\n[Healing] Cluster appears unstable. Attempting to reboot from complete outage...");
      execCommand(`${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "dba.rebootClusterFromCompleteOutage()"`, true);
      await setTimeout(10000);
      statusOut = execCommand(statusCmd, true);
    }

    if (statusOut) {
      console.log(statusOut);
    }

  } catch (error) {
    console.error("\n❌ Cluster creation failed:", error.message);
    process.exit(1);
  }
}

main();

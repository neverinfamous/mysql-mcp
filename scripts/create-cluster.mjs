import { execSync } from 'child_process';

const execCommand = (cmd) => {
  console.log(`Running: ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    if (out) console.log(out);
  } catch (e) {
    console.error(`Error: ${e.message}`);
    if (e.stdout) console.log(e.stdout.toString());
    if (e.stderr) console.error(e.stderr.toString());
  }
};

const mysqlsh = `"C:\\Program Files\\MySQL\\MySQL Shell 9.5\\bin\\mysqlsh.exe"`;

console.log("Configuring cluster...");
execCommand(`${mysqlsh} --uri root:root@127.0.0.1:3307 --js -e "try { dba.createCluster('testCluster'); } catch(e) { console.log('Cluster may already exist'); }"`);
const dockerCmd = process.platform === 'win32' ? 'wsl docker' : 'docker';
execCommand(`${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "var c = dba.getCluster('testCluster'); c.addInstance('root:root@mysql-node2:3306', {recoveryMethod: 'clone'});"`);
execCommand(`${dockerCmd} exec mysql-node1 mysqlsh --uri root:root@mysql-node1:3306 --js -e "var c = dba.getCluster('testCluster'); c.addInstance('root:root@mysql-node3:3306', {recoveryMethod: 'clone'});"`);
console.log("Cluster configuration complete.");

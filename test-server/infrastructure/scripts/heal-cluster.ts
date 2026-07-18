import { execSync } from "child_process";

console.log("🚑 Healing MySQL InnoDB Cluster from complete outage...");

try {
  // Create a temporary script inside the container
  const jsScript = `
    try {
      print("Attempting to reboot cluster from complete outage...");
      dba.rebootClusterFromCompleteOutage();
      print("Cluster rebooted successfully. It may take a few seconds for all nodes to join.");
    } catch(e) {
      print("Info/Error: " + e.message);
      var c = dba.getCluster();
      print(JSON.stringify(c.status(), null, 2));
    }
  `;

  execSync(`docker exec i mysql-node1 bash -c "echo '${jsScript}' > /tmp/heal.js"`, { stdio: 'inherit' });
  
  console.log("Running heal script inside mysql-node1...");
  execSync(`docker exec i mysql-node1 mysqlsh --uri root:root@localhost:3306 -f /tmp/heal.js`, { stdio: 'inherit' });
  
  console.log("✅ Cluster heal command completed.");
  console.log("Note: Proxysql and mysql-router will automatically detect the recovered backends within 30 seconds.");
} catch (error) {
  console.error("❌ Failed to heal cluster:", error.message);
  process.exit(1);
}

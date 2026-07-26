import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { config } from "dotenv";

// Auto-load Datadog secrets for E2E validation
if (fs.existsSync('C:/Users/chris/Desktop/adamic/secrets.env')) {
  config({ path: 'C:/Users/chris/Desktop/adamic/secrets.env' });
} else {
  config();
}

async function main() {
  console.log("🚀 Starting metrics generation load test...");
  const startTime = Math.floor(Date.now() / 1000);

  // 1. Hammer ProxySQL via native client to bypass multiplexing limits
  console.log("🔨 Spiking ProxySQL cache memory and read throughput...");
  try {
    // We explicitly route through wsl.exe to cross the OS boundary since Docker Desktop is not installed
    const child = spawn("wsl.exe", ["-e", "docker", "exec", "-i", "proxysql", "bash"], { stdio: ["pipe", "ignore", "ignore"] });
    child.on('error', err => console.error("ProxySQL loop error:", err));
    
    // Pass the script directly via stdin to completely avoid Windows cmd.exe quoting issues
    child.stdin.write(`
      mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e 'SELECT * FROM testdb.test_measurements LIMIT 200;' > /dev/null 2>&1
      for i in {1..2000}; do
        mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e 'SELECT * FROM testdb.test_measurements LIMIT 200;' > /dev/null 2>&1
      done
    `);
    child.stdin.end();
  } catch (err) {
    console.error("Failed to trigger ProxySQL spike:", err);
    process.exit(1);
  }

  // 2. Connect to mysql-mcp via stdio transport
  console.log("🔌 Spawning mysql-mcp via stdio...");
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      path.resolve(process.cwd(), "dist/cli.js"), 
      "--metrics-export", "prometheus", 
      "--port", "9464",
      "--server-host", "0.0.0.0",
      "--tool-filter", "core, json, text",
      "--audit-log", path.resolve(process.cwd(), "logs/mcp-audit.jsonl"),
      "--audit-reads"
    ],
    env: {
      ...process.env,
      MYSQL_HOST: "192.168.55.39",
      MYSQL_PORT: "6033",
      MYSQL_USER: "cluster_admin",
      MYSQL_PASSWORD: "cluster_admin",
      MYSQL_DATABASE: "testdb"
    }
  });
  
  const client = new Client({ name: "metrics-generator", version: "1.0.0" }, { capabilities: {} });
  
  await client.connect(transport);
  console.log("✅ Connected to MCP Server via stdio!");

  // 3. Generate initial Cache Misses
  console.log("📚 Generating initial Schema Cache Misses...");
  await client.callTool({ name: "mysql_list_tables", arguments: {} });
  await client.callTool({ name: "mysql_describe_table", arguments: { tableName: "test_measurements" } });

  console.log("🌊 Starting continuous load generation for 60 seconds...");
  
  // Create a flag to control the loop
  let running = true;
  setTimeout(() => {
    running = false;
  }, 65000); // Run for 65 seconds to give Prometheus ~4 scrapes

  // Function to continuously generate traffic
  const generateTraffic = async () => {
    while (running) {
      try {
        // Cache Hits (3 requests per loop)
        await client.callTool({ name: "mysql_describe_table", arguments: { tableName: "test_measurements" } });
        await client.callTool({ name: "mysql_describe_table", arguments: { tableName: "test_events" } });
        await client.callTool({ name: "mysql_describe_table", arguments: { tableName: "test_users" } });

        // Intentional Error (for error rate % and error log)
        await client.callTool({ name: "mysql_read_query", arguments: { query: "SELECT * FROM non_existent_table_for_testing" } }).catch(() => {});

        // Resource Reads
        await client.readResource({ uri: "mysql://pool" }).catch(() => {});
        await client.readResource({ uri: "mysql://cluster" }).catch(() => {});

        // Pool Utilization (Simulate a query that holds the connection for a short time)
        await client.callTool({ name: "mysql_read_query", arguments: { query: "SELECT SLEEP(0.5)" } }).catch(() => {});
        
        // Wait 1 second between loops to space out the load
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err) {
        // Ignore loop errors
      }
    }
  };

  // Run a few traffic generators concurrently to simulate concurrency (which helps with pool utilization)
  await Promise.all([
    generateTraffic(),
    generateTraffic(),
    generateTraffic(),
    generateTraffic()
  ]);

  console.log("👋 Load generation complete.");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

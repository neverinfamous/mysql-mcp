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

  // Helper to fetch the exact tokens generated from the MCP server's local Prometheus endpoint
  const getLocalTokens = async () => {
    try {
      const res = await fetch('http://localhost:9464/metrics');
      const text = await res.text();
      let tokens = 0;
      for (const line of text.split('\n')) {
        if (line.startsWith('#')) continue;
        if (line.startsWith('mysql_mcp_tool_tokens')) {
          const parts = line.split(' ');
          if (parts.length > 1) {
            tokens += parseFloat(parts[1]);
          }
        }
      }
      return tokens;
    } catch (e) {
      console.warn("⚠️ Failed to fetch local metrics:", e.message);
      return 0;
    }
  };

  const tokensBefore = await getLocalTokens();

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
  const tokensAfter = await getLocalTokens();
  const exactTokensGenerated = Math.round(tokensAfter - tokensBefore);
  const endTime = Math.floor(Date.now() / 1000);
  console.log(`\n✅ Local MCP Server reports generating exactly ${exactTokensGenerated} tokens during this run.`);

  // 4. E2E Datadog Cloud Validation
  console.log("⏳ Waiting 90 seconds for Datadog Cloud to index the metrics...");
  // Countdown timer for better UX during the long wait
  for (let i = 90; i > 0; i -= 10) {
    process.stdout.write(`   ... ${i}s remaining\r`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  console.log("   ... done!                 ");

  console.log("📊 Querying Datadog API via pup CLI to validate End-to-End ingestion...");
  try {
    // We append .as_count() so Datadog returns the exact absolute integers instead of fractional rates
    const query = 'sum:mysql_mcp.mysql_mcp_tool_tokens.count{*}.as_count()';
    // Use pup CLI instead of direct API fetch to avoid requiring DD_APP_KEY
    const output = execSync(`pup metrics query --query "${query}" --from ${startTime} --to ${endTime + 90}`, { encoding: 'utf-8' });
    const data = JSON.parse(output);
    
    if (data.series && data.series.length > 0) {
      // Sum all the points returned
      let datadogTokens = 0;
      for (const series of data.series) {
        for (const point of series.pointlist) {
          datadogTokens += point[1];
        }
      }
      
      datadogTokens = Math.round(datadogTokens);
      
      if (datadogTokens > 0) {
        console.log("✅ SUCCESS: Datadog Cloud API returned metric data!");
        console.log(`   Tokens tracked in Datadog: ${datadogTokens}`);
        
        // Mathematical Verification
        if (datadogTokens === exactTokensGenerated) {
          console.log(`\n🎯 PERFECT MATCH: Datadog accurately ingested 100% of the ${exactTokensGenerated} tokens generated!`);
        } else {
          const diff = Math.abs(datadogTokens - exactTokensGenerated);
          console.log(`\n⚠️ MATCH FAILED: Datadog reported ${datadogTokens}, but the local server generated ${exactTokensGenerated}. Difference: ${diff}`);
        }
      } else {
        console.error("❌ FAILURE: Datadog Cloud API returned data, but the sum was 0.");
      }
    } else {
      console.error("❌ FAILURE: Datadog Cloud API returned no data series for this timeframe. (Dashboard will be empty)");
      console.error("API Response:", JSON.stringify(data, null, 2));
    }
  } catch (err) {
    console.error("❌ Error fetching from Datadog API via pup CLI:", err.message);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

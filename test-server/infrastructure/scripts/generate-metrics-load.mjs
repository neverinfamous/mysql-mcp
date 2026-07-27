import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { spawn, execSync } from "child_process";
import path from "path";
import fs from "fs";
import { config } from "dotenv";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cliPath = path.resolve(__dirname, "../../../dist/cli.js");
if (!fs.existsSync(cliPath)) {
  cliPath = path.resolve(__dirname, "../../../../mysql-mcp/dist/cli.js");
}


// Auto-load Datadog secrets for E2E validation
if (fs.existsSync('C:/Users/chris/Desktop/adamic/secrets.env')) {
  config({ path: 'C:/Users/chris/Desktop/adamic/secrets.env' });
} else {
  config();
}

async function main() {
  console.log("🚀 Starting metrics generation load test...");
  const startTime = Math.floor(Date.now() / 1000);

  // 0. Generate Redis metrics load to light up dashboard widgets
  // Targets: Slowlog, Evictions, Blocked Clients, Key Distribution,
  //          Network I/O, Top Commands, Error/All Logs, Percent Used Memory
  console.log("🔴 Generating Redis metrics load...");
  try {
    const redisChild = spawn("wsl.exe", ["-e", "docker", "exec", "-i", "redis-server", "bash"], { stdio: ["pipe", "inherit", "inherit"] });
    redisChild.on('error', err => console.error("Redis load error:", err));

    const script = `
      # ─── Phase 0A: Configure eviction simulation ───────────────────────
      # Temporarily lower maxmemory so we can trigger evictions, and set
      # the ratio denominator for the "Percent Used Memory" widget.
      redis-cli CONFIG SET maxmemory 8mb 2>/dev/null
      redis-cli CONFIG SET maxmemory-policy allkeys-lru 2>/dev/null

      # ─── Phase 0B: Diverse command mix (Top Commands widget) ────────────
      # SET/GET — drives Top Commands + Network I/O bytes_in/bytes_out
      for i in $(seq 1 500); do
        redis-cli SET "load:key:$i" "value_padding_data_$i" > /dev/null 2>&1
      done
      for i in $(seq 1 500); do
        redis-cli GET "load:key:$i" > /dev/null 2>&1
      done

      # HSET/HGET — hash commands
      for i in $(seq 1 100); do
        redis-cli HSET "load:hash" "field_$i" "value_$i" > /dev/null 2>&1
      done
      redis-cli HGETALL "load:hash" > /dev/null 2>&1

      # LPUSH/LLEN — list commands
      for i in $(seq 1 100); do
        redis-cli LPUSH "load:list" "item_$i" > /dev/null 2>&1
      done
      redis-cli LLEN "load:list" > /dev/null 2>&1

      # SADD/SCARD — set commands
      for i in $(seq 1 100); do
        redis-cli SADD "load:set" "member_$i" > /dev/null 2>&1
      done
      redis-cli SCARD "load:set" > /dev/null 2>&1

      # INCR — counter commands
      for i in $(seq 1 200); do
        redis-cli INCR "load:counter" > /dev/null 2>&1
      done

      # INFO — server info command
      redis-cli INFO > /dev/null 2>&1

      # ─── Phase 0C: Key length distribution & Expirations ───────────────
      redis-cli SET "load:size:tiny" "x" > /dev/null 2>&1
      redis-cli SET "load:size:small" "$(head -c 100 /dev/urandom | base64 | head -c 100)" > /dev/null 2>&1
      redis-cli SET "load:size:medium" "$(head -c 1024 /dev/urandom | base64 | head -c 1024)" > /dev/null 2>&1
      redis-cli SET "load:size:large" "$(head -c 10240 /dev/urandom | base64 | head -c 10240)" > /dev/null 2>&1
      
      # Generate expirations (TTL = 1s)
      for i in \$(seq 1 50); do
        redis-cli SETEX "load:expire:$i" 1 "expiring_value" > /dev/null 2>&1
      done
      # Wait for them to expire so Datadog captures the event
      sleep 2

      # ─── Phase 0D: Slowlog triggers (>20ms threshold) ──────────────────
      for i in $(seq 1 10); do
        redis-cli EVAL "local t0 = redis.call('TIME'); while true do local t1 = redis.call('TIME'); if (t1[1]-t0[1])*1000000 + (t1[2]-t0[2]) > 20000 then break end end; return 1" 0 > /dev/null 2>&1
      done
      # KEYS * on a populated keyspace is naturally slow
      redis-cli KEYS "*" > /dev/null 2>&1

      # ─── Phase 0E: Eviction pressure ───────────────────────────────────
      # Flood keys with ~2KB values to exceed 8MB maxmemory limit.
      # allkeys-lru policy will evict oldest keys, lighting up the
      # Evictions widget and generating log entries.
      for i in $(seq 1 5000); do
        redis-cli SET "evict:key:$i" "$(head -c 2048 /dev/urandom | base64 | head -c 2048)" > /dev/null 2>&1
      done

      # ─── Phase 0F: Blocked clients ─────────────────────────────────────
      # BLPOP on nonexistent lists blocks for 20s each (3 concurrent clients)
      # Datadog checks every 15s, so this ensures it is captured.
      redis-cli BLPOP "load:block:1" 20 > /dev/null 2>&1 &
      redis-cli BLPOP "load:block:2" 20 > /dev/null 2>&1 &
      redis-cli BLPOP "load:block:3" 20 > /dev/null 2>&1 &
      # Wait for blocked clients to be sampled by Datadog
      sleep 20

      # ─── Phase 0H: Rejected connections & Error logs ───────────────────
      # Force a rejected connection by setting maxclients artificially low.
      # We use BLPOP with a short timeout to hold connections open without hanging forever.
      redis-cli CONFIG SET maxclients 10 > /dev/null 2>&1
      for i in \$(seq 1 15); do
        redis-cli BLPOP "load:block:reject" 2 > /dev/null 2>&1 &
      done
      # Wait for the blocked clients to timeout (2s) plus a small buffer
      sleep 3
      redis-cli CONFIG SET maxclients 10000 > /dev/null 2>&1
      
      # Force an error/warning log by attempting to replicate a dead server
      redis-cli REPLICAOF 127.0.0.1 1 > /dev/null 2>&1
      sleep 2
      redis-cli REPLICAOF NO ONE > /dev/null 2>&1

      # ─── Phase 0G: Cleanup & revert ────────────────────────────────────
      # Revert Redis to default configuration
      redis-cli CONFIG SET maxmemory 0 2>/dev/null
      redis-cli CONFIG SET maxmemory-policy noeviction 2>/dev/null

      # Remove all load test keys
      redis-cli KEYS "load:*" | xargs -r redis-cli DEL > /dev/null 2>&1
      redis-cli KEYS "evict:*" | xargs -r redis-cli DEL > /dev/null 2>&1
      echo "Redis load generation complete"
    `;
    redisChild.stdin.write(script.replace(/\\r\\n/g, '\\n'));
    redisChild.stdin.end();
  } catch (err) {
    console.error("Failed to trigger Redis load:", err);
    process.exit(1);
  }

  // 1. Hammer ProxySQL via native client to bypass multiplexing limits
  console.log("🔨 Spiking ProxySQL cache memory and read throughput...");
  try {
    // We explicitly route through wsl.exe to cross the OS boundary since Docker Desktop is not installed
    const child = spawn("wsl.exe", ["-e", "docker", "exec", "-i", "proxysql", "bash"], { stdio: ["pipe", "ignore", "ignore"] });
    child.on('error', err => console.error("ProxySQL loop error:", err));
    
    // Pass the script directly via stdin to completely avoid Windows cmd.exe quoting issues
    const script = `
      mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e 'SELECT * FROM testdb.test_measurements LIMIT 200;' > /dev/null 2>&1
      for i in {1..2000}; do
        mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e 'SELECT * FROM testdb.test_measurements LIMIT 200;' > /dev/null 2>&1
        
        # Inject DML and slow queries periodically to light up Insert/Update/Delete/Fsync/Slow/Lock metrics
        if [ $((i % 20)) -eq 0 ]; then
          mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e "INSERT INTO testdb.test_events (event_name, event_data) VALUES ('load_event_$i', '{\"load\": true}');" > /dev/null 2>&1
          mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e "UPDATE testdb.test_events SET event_name = 'updated_$i' WHERE id = (SELECT MAX(id) FROM testdb.test_events);" > /dev/null 2>&1
          mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e "DELETE FROM testdb.test_events WHERE id = (SELECT MIN(id) FROM testdb.test_events);" > /dev/null 2>&1
        fi
        
        # Generate slow queries and locks
        if [ $((i % 100)) -eq 0 ]; then
          mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e "SELECT SLEEP(1.5);" > /dev/null 2>&1
          mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e "LOCK TABLES testdb.test_events WRITE; DO SLEEP(0.5); UNLOCK TABLES;" > /dev/null 2>&1
          
          # Also send some traffic to mysql-router to light up router metrics and logs
          mysql -u cluster_admin -pcluster_admin -h mysql-router -P 6446 -e "SELECT * FROM testdb.test_events LIMIT 10;" > /dev/null 2>&1 &
          # Trigger an access denied error to generate a MySQL Error Log entry
          mysql -u cluster_admin -pwrongpassword -h mysql-node1 -P 3306 -e "SELECT 1;" > /dev/null 2>&1 &
        fi
        
        # Generate aborted connection to ProxySQL and a Slow Query
        if [ $((i % 50)) -eq 0 ]; then
           # Use a short timeout that forces abort to light up ProxySQL Connection Aborts
           timeout 0.1 mysql -u cluster_admin -pcluster_admin -h 127.0.0.1 -P 6033 -e "SELECT SLEEP(1);" > /dev/null 2>&1 || true
           
           # Generate a query longer than long_query_time (10s)
           mysql -u cluster_admin -pcluster_admin -h mysql-node1 -P 3306 -e "SELECT SLEEP(12);" > /dev/null 2>&1 &
        fi
      done
    `;
    child.stdin.write(script.replace(/\\r\\n/g, '\\n'));
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
      cliPath, 
      "--metrics-export", "prometheus", 
      "--port", "9464",
      "--server-host", "0.0.0.0",
      "--tool-filter", "core, json, text",
      "--audit-log", path.resolve(cliPath, "../../logs/mcp-audit.jsonl"),
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

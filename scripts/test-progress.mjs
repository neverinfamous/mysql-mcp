/**
 * mysql-mcp - Progress Notification Tester
 *
 * Verifies that tools correctly implement and stream progress notifications.
 */
import { spawn } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "..");

const cleanEnv = { ...process.env };
cleanEnv.ALLOWED_IO_ROOTS = projectDir;
cleanEnv.AGENT_BYPASS = "1";
cleanEnv.MCP_LOG_LEVEL = "debug";

// Spawn the server with memory metrics disabled or standard args
const proc = spawn(
  process.execPath,
  [
    "dist/cli.js",
    "--mysql",
    "mysql://root:root@localhost:3307/testdb",
    "--log-level",
    "debug",
    "--tool-filter",
    "optimization,admin,backup,core,codemode,performance"
  ],
  {
    cwd: projectDir,
    stdio: ["pipe", "pipe", "pipe"],
    env: cleanEnv,
  },
);

let buffer = "";
const pending = new Map(); // id -> resolve
const progressEvents = [];

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop(); // keep incomplete
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    console.log("RAW STDOUT:", line);
    try {
      const msg = JSON.parse(trimmed);

      // Handle notifications
      if (msg.method === "notifications/progress") {
        const isStream =
          msg.params.progressToken === "test-token-mysql_read_query";
        const prefix = isStream ? "[STREAM] Chunk" : "[PROGRESS] Step";
        console.log(
          `${prefix} ${msg.params.progress} of ${msg.params.total || "?"}: ${msg.params.message || ""}`,
        );
        progressEvents.push(msg.params);
      }

      // Handle RPC responses
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {}
  }
});

proc.stderr.on("data", (chunk) => {
  console.error(`SERVER STDERR: ${chunk}`);
});

let nextId = 1;
function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout: ${method}`)),
      300000 // 5 minutes
    );
    pending.set(id, (msg) => {
      clearTimeout(timer);
      resolve(msg);
    });
    proc.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n",
    );
  });
}

function notify(method, params = {}) {
  proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTest(toolName, args, expectedMinEvents = 1) {
  console.log(`\nTesting tool: ${toolName}...`);
  progressEvents.length = 0; // Reset array

  const response = await rpc("tools/call", {
    name: toolName,
    arguments: args,
    _meta: { progressToken: `test-token-${toolName}` },
  });

  if (response.error) {
    console.error(`  FAIL: Tool returned error:`, response.error);
    return false;
  }

  if (response.result?.isError) {
    console.error(`  FAIL: Tool returned business error:`, response.result);
    return false;
  }

  if (toolName === "mysql_read_query") {
    console.log(`  Read query result:`, JSON.stringify(response.result, null, 2));
  }

  if (progressEvents.length >= expectedMinEvents) {
    if (toolName === "mysql_read_query") {
      console.log(
        `  PASS: Received ${progressEvents.length} streaming chunks via progress notifications!`,
      );
    } else {
      console.log(
        `  PASS: Received ${progressEvents.length} progress notifications!`,
      );
    }
    return true;
  } else {
    console.error(
      `  FAIL: Expected at least ${expectedMinEvents} progress notifications, got ${progressEvents.length}`,
    );
    return false;
  }
}

async function main() {
  console.log("Initializing MCP Server...");
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test-progress", version: "1.0" },
  });
  await delay(500);
  notify("notifications/initialized");
  await delay(1000);

  const code = `
    function sleepMs(ms) {
      const start = Date.now();
      while (Date.now() - start < ms) {}
    }
    if (typeof mysql.reportProgress === 'function') {
      for (let i = 1; i <= 5; i++) {
        await mysql.reportProgress(i, 5, "Step " + i);
        sleepMs(100);
      }
      return "Success";
    }
    throw new Error("Missing reportProgress in Code Mode sandbox");
  `;

  console.log("Sending ping...");
  await rpc("ping", {});
  console.log("Ping successful.");

  console.log("Setting up test table...");
  const setupCreate = await rpc("tools/call", { name: "mysql_write_query", arguments: { query: "CREATE TABLE IF NOT EXISTS test_prog_events (id INT PRIMARY KEY AUTO_INCREMENT, val VARCHAR(50))" } });
  if (setupCreate.error) console.error("Setup CREATE failed:", setupCreate);
  
  await rpc("tools/call", { name: "mysql_write_query", arguments: { query: "TRUNCATE TABLE test_prog_events" } });
  
  for (let i = 1; i <= 20; i++) {
    await rpc("tools/call", { name: "mysql_write_query", arguments: { query: "INSERT INTO test_prog_events (val) VALUES ('val " + i + "')" } });
  }

  const tests = [
    { name: "mysql_optimize_table", args: { tables: ["test_prog_events"] }, minEvents: 2 },
    { name: "mysql_analyze_table", args: { tables: ["test_prog_events", "test_prog_events"] }, minEvents: 3 },
    { name: "mysql_check_table", args: { tables: ["test_prog_events", "test_prog_events"] }, minEvents: 3 },
    { name: "mysql_export_table", args: { tableName: "test_prog_events" }, minEvents: 1 },
    {
      name: "mysql_read_query",
      args: {
        query: "SELECT * FROM test_prog_events",
        stream: true,
        chunkSize: 5,
      },
      minEvents: 4, // 20 rows / 5 = 4 chunks
    },
    { name: "mysql_execute_code", args: { code }, minEvents: 5 },
    { 
      name: "mysql_index_recommendation", 
      args: { table: "test_prog_events", queries: ["SELECT * FROM test_prog_events WHERE id = 1", "SELECT * FROM test_prog_events WHERE val = 'a'"] }, 
      minEvents: 2 
    },
  ];

  let passed = true;

  for (const t of tests) {
    const success = await runTest(t.name, t.args, t.minEvents || 1);
    if (!success) passed = false;
  }

  await rpc("tools/call", { name: "mysql_write_query", arguments: { query: "DROP TABLE IF EXISTS test_prog_events" } });

  proc.kill();
  if (!passed) {
    process.exitCode = 1;
  } else {
    console.log(
      `\nAll ${tests.length} tools successfully tested for progress notifications and chunk streaming!`,
    );
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  proc.kill();
  process.exitCode = 1;
});

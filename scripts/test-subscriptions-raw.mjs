import { spawn } from "child_process";
import assert from "assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "..");

async function main() {
  // Ensure DB connection env vars are present
  const env = { ...process.env };
  if (!env.MYSQL_HOST) env.MYSQL_HOST = "127.0.0.1";
  if (!env.MYSQL_USER) env.MYSQL_USER = "root";
  if (!env.MYSQL_PASSWORD) env.MYSQL_PASSWORD = "root";
  if (!env.MYSQL_DATABASE) env.MYSQL_DATABASE = "testdb";

  const proc = spawn("node", ["dist/cli.js"], {
    cwd: projectDir,
    env,
    stdio: ["pipe", "pipe", "pipe"],
  });

  proc.stderr.on("data", (chunk) =>
    console.error("SERVER STDERR:", chunk.toString()),
  );

  let buffer = "";
  let notifications = [];
  let msgId = 1;

  const send = (method, params) => {
    const id = msgId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    proc.stdin.write(JSON.stringify(msg) + "\n");
    return id;
  };

  proc.stdout.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep remainder

    for (const line of lines) {
      if (!line.trim()) continue;
      // console.log("RAW STDOUT:", line); // Uncomment for debugging
      try {
        const msg = JSON.parse(line);
        if (msg.method === "notifications/resources/updated") {
          notifications.push(msg.params.uri);
          console.log("NOTIF:", msg.params.uri);
        } else if (msg.id) {
          if (msg.error) {
             console.error("Error Response for", msg.id, ":", JSON.stringify(msg.error));
          }
        }
      } catch (e) {
        // ignore incomplete
      }
    }
  });

  // Init
  send("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test", version: "1" },
  });
  await new Promise((r) => setTimeout(r, 1500));

  send("notifications/initialized", {});

  // Subscriptions
  send("resources/subscribe", { uri: "mysql://schema" });
  send("resources/subscribe", { uri: "mysql://tables" });
  send("resources/subscribe", { uri: "mysql://table/test_live_sub/schema" });
  send("resources/subscribe", { uri: "mysql://health" });

  await new Promise((r) => setTimeout(r, 500));

  function assertNotifications(expected, stepName) {
    try {
      assert.deepStrictEqual([...notifications].sort(), [...expected].sort());
      console.log(`✅ Passed ${stepName}`);
    } catch (err) {
      console.error(
        `❌ FAILED ${stepName}: Expected`,
        expected,
        `but got`,
        notifications,
      );
      process.exit(1);
    }
  }

  console.log("Mutating DB: CREATE");
  send("tools/call", {
    name: "mysql_execute_code",
    arguments: {
      code: "await mysql.core.writeQuery({ query: 'CREATE TABLE IF NOT EXISTS test_live_sub (id INT PRIMARY KEY)' }); return true;"
    },
  });
  await new Promise((r) => setTimeout(r, 1000));
  assertNotifications(
    [
      "mysql://schema",
      "mysql://tables",
      "mysql://table/test_live_sub/schema",
    ],
    "CREATE",
  );
  notifications = [];

  console.log("Mutating DB: ALTER");
  send("tools/call", {
    name: "mysql_execute_code",
    arguments: {
      code: "await mysql.core.writeQuery({ query: 'ALTER TABLE test_live_sub ADD COLUMN sub_test TEXT' }); return true;"
    },
  });
  await new Promise((r) => setTimeout(r, 1000));
  assertNotifications(
    [
      "mysql://schema",
      "mysql://tables",
      "mysql://table/test_live_sub/schema",
    ],
    "ALTER",
  );
  notifications = [];

  console.log("Mutating DB: DROP");
  send("tools/call", {
    name: "mysql_execute_code",
    arguments: {
       code: "await mysql.core.writeQuery({ query: 'DROP TABLE IF EXISTS test_live_sub' }); return true;"
    },
  });
  await new Promise((r) => setTimeout(r, 1000));
  assertNotifications(
    [
      "mysql://schema",
      "mysql://tables",
      "mysql://table/test_live_sub/schema",
    ],
    "DROP",
  );

  console.log("\n✅ All RAW subscription tests passed!");
  proc.kill();
  setTimeout(() => process.exit(0), 500);
}

main().catch(console.error);

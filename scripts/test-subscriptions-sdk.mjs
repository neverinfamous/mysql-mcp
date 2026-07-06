import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";
import assert from "assert";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(__dirname, "..");

async function main() {
  const env = { ...process.env };
  if (!env.MYSQL_HOST) env.MYSQL_HOST = "127.0.0.1";
  if (!env.MYSQL_USER) env.MYSQL_USER = "root";
  if (!env.MYSQL_PASSWORD) env.MYSQL_PASSWORD = "root";
  if (!env.MYSQL_DATABASE) env.MYSQL_DATABASE = "testdb";
  if (!env.MYSQL_PORT) env.MYSQL_PORT = "3307";
  env.AGENT_BYPASS = "1";
  env.ALLOWED_IO_ROOTS = projectDir;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/cli.js", "--tool-filter", "codemode"],
    env,
  });

  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} },
  );
  await client.connect(transport);

  console.log("Connected.");
  let notifications = [];

  const ResourceUpdatedNotificationSchema = z
    .object({ method: z.literal("notifications/resources/updated") })
    .passthrough();
  client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notif) => {
    const uri = notif.params ? notif.params.uri : notif.uri;
    notifications.push(uri);
    console.log("Notification received:", uri);
  });

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

  const testSub = async (uri) => {
    try {
      await client.request(
        { method: "resources/subscribe", params: { uri } },
        z.any(),
      );
      console.log(`✅ Subbed ${uri}: OK`);
    } catch (e) {
      console.error(`❌ Sub ${uri} failed:`, e);
      process.exit(1);
    }
  };

  const testSubFail = async (uri) => {
    try {
      await client.request(
        { method: "resources/subscribe", params: { uri } },
        z.any(),
      );
      console.error(`❌ FAILED Sub ${uri}: SUCCESS (Should have failed)`);
      process.exit(1);
    } catch (e) {
      console.log(`✅ Sub ${uri}: Error (Expected)`);
    }
  };

  // Test A: Valid Subscriptions
  await testSub("mysql://schema");
  await testSub("mysql://tables");
  await testSub("mysql://table/test_live_sub/schema");
  await testSub("mysql://health");
  // Immediately unsubscribe from health so it doesn't pollute subsequent strict-equality checks
  await client.request({ method: "resources/unsubscribe", params: { uri: "mysql://health" } }, z.any());

  // Test C: Invalid Subscriptions
  await testSubFail("mysql://meta");
  await testSubFail("mysql://help");
  await testSubFail("mysql://invalid_uri");

  // Test B: Mutate and wait
  console.log("Mutating DB: CREATE");
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "mysql_execute_code",
        arguments: {
          code: "await mysql.core.writeQuery({ query: 'CREATE TABLE IF NOT EXISTS test_live_sub (id INT PRIMARY KEY)' }); return true;"
        },
      },
    },
    z.any(),
  );
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
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "mysql_execute_code",
        arguments: {
          code: "await mysql.core.writeQuery({ query: 'ALTER TABLE test_live_sub ADD COLUMN sub_test TEXT' }); return true;"
        },
      },
    },
    z.any(),
  );
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
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "mysql_execute_code",
        arguments: {
          code: "await mysql.core.writeQuery({ query: 'DROP TABLE IF EXISTS test_live_sub' }); return true;"
        },
      },
    },
    z.any(),
  );
  await new Promise((r) => setTimeout(r, 1000));
  assertNotifications(
    [
      "mysql://schema",
      "mysql://tables",
      "mysql://table/test_live_sub/schema",
    ],
    "DROP",
  );
  notifications = [];

  // Test D: Unsubscribe
  console.log("Mutating DB: UNSUBSCRIBE schema");
  await client.request(
    { method: "resources/unsubscribe", params: { uri: "mysql://schema" } },
    z.any(),
  );
  console.log("Unsubbed schema");

  await client.request(
    {
      method: "tools/call",
      params: {
        name: "mysql_execute_code",
        arguments: {
          code: "await mysql.core.writeQuery({ query: 'CREATE TABLE IF NOT EXISTS test_live_sub2 (id INT PRIMARY KEY)' }); return true;"
        },
      },
    },
    z.any(),
  );
  await new Promise((r) => setTimeout(r, 1000));
  assertNotifications(
    ["mysql://tables", "mysql://table/test_live_sub/schema"],
    "UNSUBSCRIBE CREATE",
  );
  notifications = [];

  // Clean up
  await client.request(
    {
      method: "tools/call",
      params: {
        name: "mysql_execute_code",
        arguments: {
          code: "await mysql.core.writeQuery({ query: 'DROP TABLE IF EXISTS test_live_sub2' }); return true;"
        },
      },
    },
    z.any(),
  );

  console.log("\n✅ All SDK subscription tests passed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});

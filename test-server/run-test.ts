import { getTransactionTools } from "../src/adapters/mysql/tools/transactions.js";
import { MySQLAdapter } from "../src/adapters/mysql/mysql-adapter/index.js";
import { ConfigLoader } from "../src/config/config-loader.js";
import { setupEnv } from "./test-setup.js";

async function run() {
  await setupEnv();
  const config = await ConfigLoader.load();
  const adapter = new MySQLAdapter(config.server.mysql);
  await adapter.connect();

  const tools = getTransactionTools(adapter);
  const executeTool = tools.find((t: any) => t.name === "mysql_transaction_execute");

  if (!executeTool) {
    console.error("Tool not found");
    process.exit(1);
  }

  // Test fuzzing payload 1 (invalid statement type)
  console.log("TEST 1: Invalid statement type");
  let res = await executeTool.handler({
    statements: [{ invalid: "property" }]
  }, {} as any);
  console.log(JSON.stringify(res, null, 2));

  // Test fuzzing payload 2 (SQL error)
  console.log("TEST 2: SQL error");
  res = await executeTool.handler({
    statements: ["SELECT * FROM non_existent_table"]
  }, {} as any);
  console.log(JSON.stringify(res, null, 2));

  await adapter.disconnect();
}

run().catch(console.error);

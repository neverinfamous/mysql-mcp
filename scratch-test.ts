import { createAnalyzeTableTool, createOptimizeTableTool } from "./src/adapters/mysql/tools/admin/maintenance.js";
import { MySQLAdapter } from "./src/adapters/mysql/mysql-adapter/index.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";

async function run() {
  const adapter = new MySQLAdapter();
  await adapter.connect({
    host: "127.0.0.1",
    port: 3306,
    username: "root",
    password: "password",
    database: "mysql_mcp_test"
  });

  const analyze = createAnalyzeTableTool(adapter);
  
  console.log("Testing analyze empty tables array");
  try {
    const res = await analyze.handler({ tables: [] }, { progressToken: "1" } as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }

  console.log("Testing analyze missing table");
  try {
    const res = await analyze.handler({ tables: ["non_existent_table"] }, { progressToken: "1" } as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }

  console.log("Testing analyze real table with histograms");
  try {
    // We need a real table. Let's create one.
    await adapter.executeQuery(`CREATE TABLE IF NOT EXISTS test_table (id INT PRIMARY KEY, val VARCHAR(100))`);
    const res = await analyze.handler({ tables: ["test_table"], update_histograms: true }, { progressToken: "1" } as any);
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error(e);
  }

  await adapter.close();
}

run().catch(console.error);

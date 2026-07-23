import { MySQLAdapter } from "./src/adapters/mysql/mysql-adapter/index.js";
import { createOptimizeTableTool, createAnalyzeTableTool } from "./src/adapters/mysql/tools/admin/maintenance.ts";
import { resolve } from "path";
import { config } from "dotenv";

config();

async function run() {
  const adapter = new MySQLAdapter({
    uri: process.env.MYSQL_URI || "mysql://root:root@localhost:3306/test",
  });
  
  await adapter.connect();

  const optimize = createOptimizeTableTool(adapter);
  const analyze = createAnalyzeTableTool(adapter);

  console.log("Testing optimize with missing table:");
  const res1 = await optimize.handler({ tables: ["missing_table"] }, { progressToken: "1" } as any);
  console.log("Optimize missing result:", JSON.stringify(res1, null, 2));

  console.log("Testing analyze with missing table:");
  const res2 = await analyze.handler({ tables: ["missing_table"] }, { progressToken: "2" } as any);
  console.log("Analyze missing result:", JSON.stringify(res2, null, 2));

  console.log("Testing analyze with histograms:");
  try {
    const res3 = await analyze.handler({ tables: ["users"], update_histograms: true }, { progressToken: "3" } as any);
    console.log("Analyze histograms result:", JSON.stringify(res3, null, 2));
  } catch (e) {
    console.error("Histograms error:", e);
  }

  await adapter.close();
}

run().catch(console.error);

import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), "../../secrets.env") });

import { MySQLAdapter } from "./src/adapters/mysql/mysql-adapter.js";
import { createFulltextSearchTool } from "./src/adapters/mysql/tools/text/fulltext.js";

async function main() {
  const adapter = new MySQLAdapter();
  await adapter.connect({ host: "localhost", port: 3306, username: "root", database: "testdb" });
  
  const searchTool = createFulltextSearchTool(adapter);
  
  const result = await searchTool.handler({
    table: "test_articles",
    columns: ["title", "body"],
    query: "MySQL",
    includeFacets: true
  }, {} as any);
  
  console.log(JSON.stringify(result, null, 2));
  
  await adapter.disconnect();
}
main().catch(console.error);

import { MySQLAdapter } from "./src/adapters/mysql/mysql-adapter/index.js";
import { getTransactionTools } from "./src/adapters/mysql/tools/transactions.js";

async function main() {
  const adapter = new MySQLAdapter();
  
  // Mock adapter methods to avoid needing a real DB
  adapter.beginTransaction = async (isoLevel) => "tx-123";
  adapter.commitTransaction = async (txId) => {};
  adapter.rollbackTransaction = async (txId) => {};

  const tools = getTransactionTools(adapter);
  const beginTool = tools.find((t) => t.name === "mysql_transaction_begin");
  const commitTool = tools.find((t) => t.name === "mysql_transaction_commit");

  console.log("=== Testing mysql_transaction_begin ===");
  
  console.log("Valid:");
  let res = await beginTool.handler({ isolationLevel: "READ COMMITTED" }, {} as any);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nInvalid (number):");
  res = await beginTool.handler({ isolationLevel: 123 }, {} as any);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nInvalid (unknown string):");
  res = await beginTool.handler({ isolationLevel: "INVALID LEVEL" }, {} as any);
  console.log(JSON.stringify(res, null, 2));

  console.log("\n=== Testing mysql_transaction_commit ===");
  
  console.log("Valid:");
  res = await commitTool.handler({ transactionId: "tx-123" }, {} as any);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nInvalid (missing txId):");
  res = await commitTool.handler({}, {} as any);
  console.log(JSON.stringify(res, null, 2));

  console.log("\nInvalid (boolean txId):");
  res = await commitTool.handler({ transactionId: true }, {} as any);
  console.log(JSON.stringify(res, null, 2));
}

main().catch(console.error);

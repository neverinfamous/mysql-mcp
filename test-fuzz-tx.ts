import { createTransactionRollbackTool, getTransactionTools } from "./src/adapters/mysql/tools/transactions.ts";

async function run() {
  const mockAdapter: any = {
    getTransactionConnection: (id: string) => id === "valid-id" ? { query: async (q: string) => { if (q.includes("error")) throw new Error("db error"); } } : undefined,
    rollbackTransaction: async (id: string) => {
      if (id !== "valid-id") throw new Error("Transaction not found: " + id);
    }
  };

  const tools = getTransactionTools(mockAdapter);
  const rollbackTool = tools.find(t => t.name === "mysql_transaction_rollback")!;
  const savepointTool = tools.find(t => t.name === "mysql_transaction_savepoint")!;

  console.log("--- Rollback Tool ---");
  console.log(await rollbackTool.handler({ transactionId: "invalid-id" }, {} as any));
  
  console.log("--- Savepoint Tool ---");
  console.log(await savepointTool.handler({ transactionId: "valid-id", savepoint: "123invalid" }, {} as any));
  console.log(await savepointTool.handler({ transactionId: "valid-id", savepoint: "valid_name" }, {} as any));
  console.log(await savepointTool.handler({ transactionId: "invalid-id", savepoint: "valid_name" }, {} as any));
}

run().catch(console.error);

import { getTransactionTools } from "./src/adapters/mysql/tools/transactions.ts";

async function run() {
  const mockAdapter: any = {
    getTransactionConnection: (id: string) => id === "valid-id" ? { query: async (q: string) => { if (q.includes("error")) throw new Error("db error"); } } : undefined,
    rollbackTransaction: async (id: string) => {
      // simulate real rollback
      if (id !== "valid-id") {
         const { TransactionError } = await import("./src/types/index.ts");
         throw new TransactionError(`Transaction not found: ${id}`);
      }
    },
    activeTransactions: new Map([["valid-id", {}]]),
  };

  const tools = getTransactionTools(mockAdapter);
  const rollback = tools.find(t => t.name === "mysql_transaction_rollback")!;
  const savepoint = tools.find(t => t.name === "mysql_transaction_savepoint")!;

  const testCases = [
    undefined,
    null,
    {},
    [],
    { tx: "valid-id" },
    { transactionId: "invalid-id" },
    { transactionId: "valid-id", savepoint: "" },
    { transactionId: "valid-id", savepoint: 123 },
    { transactionId: "valid-id", savepoint: "valid" },
    { transactionId: "valid-id", savepoint: "invalid-name!" },
  ];

  console.log("--- Fuzz Rollback ---");
  for (const tc of testCases) {
    try {
      const res = await rollback.handler(tc, {} as any);
      console.log(`tc:`, tc, "=>", res.success, res.error || (res.data as any)?.message || "OK");
    } catch (e: any) {
      console.log(`tc:`, tc, "=> CRASH!", e.message);
    }
  }

  console.log("\n--- Fuzz Savepoint ---");
  for (const tc of testCases) {
    try {
      const res = await savepoint.handler(tc, {} as any);
      console.log(`tc:`, tc, "=>", res.success, res.error || (res.data as any)?.savepoint || "OK");
    } catch (e: any) {
      console.log(`tc:`, tc, "=> CRASH!", e.message);
    }
  }
}

run().catch(console.error);
